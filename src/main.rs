use std::sync::Arc;

use axum::routing::{delete, get, post, put};
use axum::{Extension, Router};
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

mod auth;
mod config;
mod controllers;
mod db;
mod error;
mod middleware;
mod models;
mod services;
mod state;
mod utils;

use config::AppConfig;
use services::rag_cache::RagCache;
use state::AppState;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let config = AppConfig::from_env();

    // Database
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .expect("failed to connect to database");

    tracing::info!("connected to database");

    tracing::info!("skipping auto-migrations — run `cargo run --bin migrate` to apply");

    // S3 (optional)
    let bucket = if let Some(ref s3_config) = config.s3 {
        match services::s3::create_bucket(s3_config) {
            Ok(b) => {
                tracing::info!("S3 bucket connected");
                Some(Arc::new(b))
            }
            Err(e) => {
                tracing::error!("S3 init failed: {e} — document upload disabled");
                None
            }
        }
    } else {
        None
    };

    // RAG Cache (per-KB agent factory)
    let rag_cache = RagCache::new(db.clone(), config.openai_api_key.clone());

    let state = AppState {
        db: db.clone(),
        bucket,
        config: Arc::new(config.clone()),
        rag_cache: Arc::new(rag_cache),
    };

    // Background indexer (only if S3 configured)
    if state.bucket.is_some() {
        let indexer_state = state.clone();
        tokio::spawn(async move {
            services::indexer::run_indexer_loop(indexer_state).await;
        });
    }

    // Background cache eviction
    let evict_state = state.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(300)).await;
            evict_state.rag_cache.evict_stale().await;
        }
    });

    // Chat worker pool (fixed N workers polling DB for jobs)
    services::chat_worker::spawn_workers(state.clone());

    // Stale chat job cleanup
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
            services::chat_worker::cleanup_stale_jobs(&cleanup_state).await;
        }
    });

    // Rate limiters (per-IP): auth=tight, api=moderate, webhook=separate
    let auth_limiter = middleware::rate_limit::create_limiter(5, 10);
    let api_limiter = middleware::rate_limit::create_limiter(20, 40);
    let webhook_limiter = middleware::rate_limit::create_limiter(10, 20);

    // Routes
    let auth_routes = Router::new()
        .route("/auth/google", get(controllers::auth::google_redirect))
        .route(
            "/auth/google/callback",
            get(controllers::auth::google_callback),
        )
        .route("/auth/dev-login", post(controllers::auth::dev_login))
        .layer(axum::middleware::from_fn(middleware::rate_limit::check_rate_limit))
        .layer(Extension(auth_limiter));

    let api_routes = Router::new()
        // Health
        .route("/api/health", get(|| async { "ok" }))
        // Auth
        .route("/api/auth/me", get(controllers::auth::me))
        .route("/api/auth/providers", get(controllers::auth::providers))
        .route("/auth/logout", post(controllers::auth::logout))
        // Knowledgebases (top-level)
        .route(
            "/api/kbs",
            get(controllers::knowledgebases::list)
                .post(controllers::knowledgebases::create),
        )
        // KB operations (KbAccess extractor)
        .route(
            "/api/kb/{kb_id}",
            get(controllers::knowledgebases::get)
                .delete(controllers::knowledgebases::delete),
        )
        .route(
            "/api/kb/{kb_id}/settings",
            get(controllers::settings::get_settings)
                .put(controllers::settings::update_settings),
        )
        // KB invite
        .route(
            "/api/kb/{kb_id}/invite",
            post(controllers::knowledgebases::invite),
        )
        // Folders
        .route(
            "/api/kb/{kb_id}/folders",
            post(controllers::folders::create)
                .get(controllers::folders::list),
        )
        .route(
            "/api/kb/{kb_id}/folders/{id}/rename",
            put(controllers::folders::rename),
        )
        .route(
            "/api/kb/{kb_id}/folders/{id}/move",
            put(controllers::folders::move_folder),
        )
        .route(
            "/api/kb/{kb_id}/folders/{id}/category",
            put(controllers::folders::update_category),
        )
        .route(
            "/api/kb/{kb_id}/folders/{id}",
            delete(controllers::folders::delete),
        )
        // Documents
        .route(
            "/api/kb/{kb_id}/documents/{id}/move",
            put(controllers::folders::move_document),
        )
        .route(
            "/api/kb/{kb_id}/documents",
            post(controllers::documents::upload)
                .get(controllers::documents::list),
        )
        .route(
            "/api/kb/{kb_id}/documents/{id}",
            get(controllers::documents::get)
                .delete(controllers::documents::delete),
        )
        .route(
            "/api/kb/{kb_id}/documents/{id}/reindex",
            post(controllers::documents::reindex),
        )
        .route(
            "/api/kb/{kb_id}/documents/{id}/content",
            get(controllers::documents::content),
        )
        .route(
            "/api/kb/{kb_id}/documents/{id}/pages",
            get(controllers::documents::pages),
        )
        .route(
            "/api/kb/{kb_id}/query",
            post(controllers::query::query),
        )
        .route(
            "/api/kb/{kb_id}/retrieve",
            post(controllers::retrieve::retrieve),
        )
        // Chat sessions
        .route(
            "/api/kb/{kb_id}/sessions",
            get(controllers::chat_sessions::list_sessions)
                .post(controllers::chat_sessions::create_session),
        )
        .route(
            "/api/kb/{kb_id}/sessions/{sid}",
            get(controllers::chat_sessions::get_session),
        )
        .route(
            "/api/kb/{kb_id}/sessions/{sid}/messages",
            post(controllers::chat_sessions::send_message),
        )
        .route(
            "/api/kb/{kb_id}/sessions/{sid}/stream",
            post(controllers::chat_sessions::stream_message),
        )
        // KB members (RBAC)
        .route(
            "/api/kb/{kb_id}/members",
            get(controllers::settings::list_kb_members)
                .post(controllers::settings::add_kb_member),
        )
        .route(
            "/api/kb/{kb_id}/members/{user_id}",
            delete(controllers::settings::remove_kb_member),
        )
        // Wiki
        .route(
            "/api/kb/{kb_id}/wiki",
            get(controllers::wiki::list_pages),
        )
        .route(
            "/api/kb/{kb_id}/wiki/{slug}",
            get(controllers::wiki::get_page),
        )
        // API keys
        .route(
            "/api/kb/{kb_id}/api-keys",
            get(controllers::api_keys::list)
                .post(controllers::api_keys::create),
        )
        .route(
            "/api/kb/{kb_id}/api-keys/{key_id}",
            delete(controllers::api_keys::revoke),
        )
        // Billing (per-KB)
        .route(
            "/api/kb/{kb_id}/billing",
            get(controllers::billing::get_kb_billing),
        )
        .route(
            "/api/kb/{kb_id}/billing/checkout",
            post(controllers::billing::create_kb_checkout),
        )
        // Billing portal (user-level — manage payment methods)
        .route(
            "/api/billing/portal",
            post(controllers::billing::create_portal),
        )
        // Admin
        .route("/api/admin/users", get(controllers::admin::list_users))
        .route("/api/admin/kbs", get(controllers::admin::list_kbs))
        .route(
            "/api/admin/settings",
            get(controllers::admin::list_settings)
                .put(controllers::admin::update_setting),
        )
        .route(
            "/api/admin/audit-logs",
            get(controllers::admin::list_audit_logs),
        )
        .route(
            "/api/admin/agent-logs",
            get(controllers::admin::list_agent_logs),
        )
        .route(
            "/api/admin/agent-logs/{id}",
            get(controllers::admin::get_agent_log),
        )
        .route(
            "/api/admin/subscriptions",
            get(controllers::admin::list_subscriptions),
        )
        .route(
            "/api/admin/webhook-events",
            get(controllers::admin::list_webhook_events),
        )
        .route(
            "/api/admin/llm-logs",
            get(controllers::admin::list_llm_logs),
        )
        // Invitations
        .route(
            "/api/invitations/accept",
            post(controllers::knowledgebases::accept_invite),
        );

    // Stripe webhook — separate rate limiter
    let webhook_routes = Router::new()
        .route(
            "/webhooks/stripe",
            post(controllers::webhooks::stripe_webhook),
        )
        .layer(axum::middleware::from_fn(middleware::rate_limit::check_rate_limit))
        .layer(Extension(webhook_limiter));

    // Apply API rate limiter
    let api_routes = api_routes
        .layer(axum::middleware::from_fn(middleware::rate_limit::check_rate_limit))
        .layer(Extension(api_limiter));

    let app = auth_routes
        .merge(api_routes)
        .merge(webhook_routes)
        .with_state(state)
        .fallback_service(
            ServeDir::new("frontend/dist")
                .fallback(ServeFile::new("frontend/dist/index.html")),
        )
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr = format!("{}:{}", config.host, config.port);
    tracing::info!("listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
