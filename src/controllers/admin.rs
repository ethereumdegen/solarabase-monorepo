use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;

use crate::auth::extractors::AdminUser;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::services::audit;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl PaginationParams {
    fn limit(&self) -> i64 {
        self.limit.unwrap_or(50).min(100).max(1)
    }
    fn offset(&self) -> i64 {
        self.offset.unwrap_or(0).max(0)
    }
}

/// GET /api/admin/users
pub async fn list_users(
    AdminUser(_user): AdminUser,
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<Json<serde_json::Value>> {
    let limit = params.limit();
    let offset = params.offset();
    let users = db::users::list_paginated(&state.db, limit, offset).await?;
    let total = db::users::count(&state.db).await?;
    Ok(Json(serde_json::json!({ "users": users, "total": total, "limit": limit, "offset": offset })))
}

/// GET /api/admin/kbs
pub async fn list_kbs(
    AdminUser(_user): AdminUser,
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<Json<serde_json::Value>> {
    let limit = params.limit();
    let offset = params.offset();
    let kbs = db::knowledgebases::list_paginated(&state.db, limit, offset).await?;
    let total = db::knowledgebases::count_all(&state.db).await?;
    Ok(Json(serde_json::json!({ "kbs": kbs, "total": total, "limit": limit, "offset": offset })))
}

/// GET /api/admin/settings
pub async fn list_settings(
    AdminUser(_user): AdminUser,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let settings = db::app_settings::get_all(&state.db).await?;
    Ok(Json(serde_json::json!(settings)))
}

#[derive(Deserialize)]
pub struct UpdateSetting {
    pub key: String,
    pub value: String,
}

/// PUT /api/admin/settings
pub async fn update_setting(
    AdminUser(user): AdminUser,
    State(state): State<AppState>,
    Json(req): Json<UpdateSetting>,
) -> AppResult<Json<serde_json::Value>> {
    if req.key.trim().is_empty() || req.key.len() > 128 {
        return Err(AppError::BadRequest("key must be 1-128 characters".into()));
    }
    if req.value.len() > 4096 {
        return Err(AppError::BadRequest("value must be at most 4096 characters".into()));
    }
    let setting = db::app_settings::set(&state.db, &req.key, &req.value).await?;

    audit::log(
        state.db.clone(),
        Some(user.id),
        "update_setting",
        "app_settings",
        None,
        Some(serde_json::json!({ "key": req.key })),
    );

    Ok(Json(serde_json::json!(setting)))
}

/// GET /api/admin/audit-logs
pub async fn list_audit_logs(
    AdminUser(_user): AdminUser,
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<Json<serde_json::Value>> {
    let limit = params.limit();
    let offset = params.offset();
    let logs = db::audit_logs::list(&state.db, limit, offset).await?;
    let total = db::audit_logs::count(&state.db).await?;
    Ok(Json(serde_json::json!({ "logs": logs, "total": total, "limit": limit, "offset": offset })))
}
