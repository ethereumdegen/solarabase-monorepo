use axum::extract::State;
use axum::Json;

use crate::auth::extractors::AuthUser;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::services::stripe as stripe_svc;
use crate::state::AppState;

/// GET /api/billing
pub async fn get_billing(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let sub = db::subscriptions::get_or_create_free(&state.db, user.id).await?;
    let query_usage = db::subscriptions::get_usage(&state.db, user.id, "queries").await?;

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

/// POST /api/billing/checkout
pub async fn create_checkout(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CheckoutRequest>,
) -> AppResult<Json<serde_json::Value>> {
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
        &user.email,
        &user.id.to_string(),
        &req.plan,
    )
    .await?;

    Ok(Json(serde_json::json!({ "url": url })))
}

/// POST /api/billing/portal
pub async fn create_portal(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let stripe = state.config.stripe.as_ref()
        .ok_or_else(|| AppError::BadRequest("Stripe billing not configured".into()))?;

    let sub = db::subscriptions::get_for_user(&state.db, user.id)
        .await?
        .ok_or_else(|| AppError::BadRequest("no subscription".into()))?;

    let customer_id = sub
        .stripe_customer_id
        .ok_or_else(|| AppError::BadRequest("no stripe customer".into()))?;

    let url = stripe_svc::create_portal_session(stripe, &customer_id).await?;

    Ok(Json(serde_json::json!({ "url": url })))
}
