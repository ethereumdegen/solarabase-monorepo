use std::sync::Arc;

use axum::routing::{delete, get, post, put};
use axum::Router;
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

    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .expect("failed to run migrations");

    tracing::info!("migrations complete");

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

    // Routes
    let auth_routes = Router::new()
        .route("/auth/google", get(controllers::auth::google_redirect))
        .route(
            "/auth/google/callback",
            get(controllers::auth::google_callback),
        )
        .route("/auth/dev-login", post(controllers::auth::dev_login));

    let api_routes = Router::new()
        // Health
        .route("/api/health", get(|| async { "ok" }))
        // Auth
        .route("/api/auth/me", get(controllers::auth::me))
        .route("/api/auth/providers", get(controllers::auth::providers))
        .route("/auth/logout", post(controllers::auth::logout))
        // Workspaces
        .route("/api/workspaces", get(controllers::workspaces::list))
        .route("/api/workspaces", post(controllers::workspaces::create))
        .route(
            "/api/workspaces/{ws_id}",
            get(controllers::workspaces::get)
                .put(controllers::workspaces::update)
                .delete(controllers::workspaces::delete),
        )
        .route(
            "/api/workspaces/{ws_id}/members",
            get(controllers::workspaces::list_members),
        )
        .route(
            "/api/workspaces/{ws_id}/invite",
            post(controllers::workspaces::invite),
        )
        .route(
            "/api/workspaces/{ws_id}/members/{user_id}",
            delete(controllers::workspaces::remove_member),
        )
        // Knowledgebases (under workspace)
        .route(
            "/api/workspaces/{ws_id}/kbs",
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
        // Billing
        .route(
            "/api/workspaces/{ws_id}/billing",
            get(controllers::billing::get_billing),
        )
        .route(
            "/api/workspaces/{ws_id}/billing/checkout",
            post(controllers::billing::create_checkout),
        )
        .route(
            "/api/workspaces/{ws_id}/billing/portal",
            post(controllers::billing::create_portal),
        )
        // Invitations
        .route(
            "/api/invitations/accept",
            post(controllers::workspaces::accept_invite),
        )
        // Stripe webhook
        .route(
            "/webhooks/stripe",
            post(controllers::webhooks::stripe_webhook),
        );

    let app = auth_routes
        .merge(api_routes)
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
