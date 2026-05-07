use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use crate::auth::extractors::AuthUser;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::services::stripe as stripe_svc;
use crate::state::AppState;

/// GET /api/workspaces/:ws_id/billing
pub async fn get_billing(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(ws_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let ws = db::workspaces::get_by_id(&state.db, ws_id)
        .await?
        .ok_or_else(|| AppError::NotFound("workspace not found".into()))?;
    if ws.owner_id != user.id {
        return Err(AppError::Forbidden("only owner can view billing".into()));
    }

    let sub = db::subscriptions::get_or_create_free(&state.db, ws_id).await?;
    let query_usage = db::subscriptions::get_usage(&state.db, ws_id, "queries").await?;

    Ok(Json(serde_json::json!({
        "subscription": sub,
        "usage": {
            "queries": query_usage,
        },
    })))
}

#[derive(serde::Deserialize)]
pub struct CheckoutRequest {
    pub plan: String,
}

/// POST /api/workspaces/:ws_id/billing/checkout
pub async fn create_checkout(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(ws_id): Path<Uuid>,
    Json(req): Json<CheckoutRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let ws = db::workspaces::get_by_id(&state.db, ws_id)
        .await?
        .ok_or_else(|| AppError::NotFound("workspace not found".into()))?;
    if ws.owner_id != user.id {
        return Err(AppError::Forbidden("only owner can manage billing".into()));
    }

    let price_id = match req.plan.as_str() {
        "pro" => &state.config.stripe_pro_price_id,
        "team" => &state.config.stripe_team_price_id,
        _ => return Err(AppError::BadRequest("invalid plan".into())),
    };

    let url = stripe_svc::create_checkout_session(
        &state.config,
        price_id,
        &user.email,
        &ws_id.to_string(),
        &req.plan,
    )
    .await?;

    Ok(Json(serde_json::json!({ "url": url })))
}

/// POST /api/workspaces/:ws_id/billing/portal
pub async fn create_portal(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(ws_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let ws = db::workspaces::get_by_id(&state.db, ws_id)
        .await?
        .ok_or_else(|| AppError::NotFound("workspace not found".into()))?;
    if ws.owner_id != user.id {
        return Err(AppError::Forbidden("only owner can manage billing".into()));
    }

    let sub = db::subscriptions::get_for_workspace(&state.db, ws_id)
        .await?
        .ok_or_else(|| AppError::BadRequest("no subscription".into()))?;

    let customer_id = sub
        .stripe_customer_id
        .ok_or_else(|| AppError::BadRequest("no stripe customer".into()))?;

    let url = stripe_svc::create_portal_session(&state.config, &customer_id).await?;

    Ok(Json(serde_json::json!({ "url": url })))
}
