use axum::extract::State;
use axum::Json;
use serde::Deserialize;

use crate::auth::extractors::AdminUser;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// GET /api/admin/users
pub async fn list_users(
    AdminUser(_user): AdminUser,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let users = db::users::list_all(&state.db).await?;
    Ok(Json(serde_json::json!(users)))
}

/// GET /api/admin/kbs
pub async fn list_kbs(
    AdminUser(_user): AdminUser,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let kbs = db::knowledgebases::list_all(&state.db).await?;
    Ok(Json(serde_json::json!(kbs)))
}

/// GET /api/admin/settings — list all app settings
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

/// PUT /api/admin/settings — upsert a single app setting
pub async fn update_setting(
    AdminUser(_user): AdminUser,
    State(state): State<AppState>,
    Json(req): Json<UpdateSetting>,
) -> AppResult<Json<serde_json::Value>> {
    if req.key.trim().is_empty() {
        return Err(AppError::BadRequest("key must not be empty".into()));
    }
    let setting = db::app_settings::set(&state.db, &req.key, &req.value).await?;
    Ok(Json(serde_json::json!(setting)))
}
