use axum::extract::State;
use axum::Json;

use crate::auth::extractors::{AuthUser, KbAccess};
use crate::db;
use crate::error::{AppError, AppResult};
use crate::services::stripe as stripe_svc;
use crate::state::AppState;

/// GET /api/kb/:kb_id/billing
pub async fn get_kb_billing(
    kb_access: KbAccess,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let sub = db::subscriptions::get_or_create_free(&state.db, kb_access.kb.id, kb_access.kb.owner_id).await?;
    let query_usage = db::subscriptions::get_usage(&state.db, kb_access.kb.id, "queries").await?;

    Ok(Json(serde_json::json!({
        "subscription": sub,
        "usage": {
            "queries": query_usage,
        },
        "stripe_enabled": state.config.stripe.is_some(),
    })))
}

#[derive(serde::Deserialize)]
pub struct CheckoutRequest {
    pub plan: String,
}

/// POST /api/kb/:kb_id/billing/checkout
pub async fn create_kb_checkout(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Json(req): Json<CheckoutRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if !kb_access.can_admin() {
        return Err(AppError::Forbidden("admin required to manage billing".into()));
    }

    // Guard: don't create duplicate checkout if KB already has paid subscription
    let existing = db::subscriptions::get_for_kb(&state.db, kb_access.kb.id).await?;
    if let Some(ref sub) = existing {
        if sub.plan != crate::models::subscription::PlanTier::Free && sub.status == crate::models::subscription::SubscriptionStatus::Active {
            return Err(AppError::BadRequest(
                "This KB already has an active paid subscription. Use the billing portal to manage it.".into(),
            ));
        }
    }

    let stripe = state.config.stripe.as_ref()
        .ok_or_else(|| AppError::BadRequest("Stripe billing not configured".into()))?;

    let price_id = match req.plan.as_str() {
        "pro" => &stripe.pro_price_id,
        "team" => &stripe.team_price_id,
        _ => return Err(AppError::BadRequest("invalid plan".into())),
    };

    let url = stripe_svc::create_checkout_session(
        stripe,
        price_id,
        &kb_access.user.email,
        &kb_access.user.id.to_string(),
        &kb_access.kb.id.to_string(),
        &req.plan,
    )
    .await?;

    Ok(Json(serde_json::json!({ "url": url })))
}

/// POST /api/billing/portal — user-level (manage payment methods)
pub async fn create_portal(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let stripe = state.config.stripe.as_ref()
        .ok_or_else(|| AppError::BadRequest("Stripe billing not configured".into()))?;

    // Find any subscription for this user that has a stripe customer ID
    let customer_id: Option<String> = sqlx::query_scalar(
        "SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1",
    )
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .flatten();

    let customer_id = customer_id
        .ok_or_else(|| AppError::BadRequest("no stripe customer found".into()))?;

    let url = stripe_svc::create_portal_session(stripe, &customer_id).await?;

    Ok(Json(serde_json::json!({ "url": url })))
}
