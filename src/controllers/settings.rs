use axum::extract::State;
use axum::Json;
use serde::Deserialize;

use crate::auth::extractors::KbAccess;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::models::workspace::WorkspaceRole;
use crate::state::AppState;

/// GET /api/kb/:kb_id/settings
pub async fn get_settings(
    kb_access: KbAccess,
) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!(kb_access.kb)))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettings {
    pub name: Option<String>,
    pub description: Option<String>,
    pub system_prompt: Option<String>,
    pub model: Option<String>,
    pub accent_color: Option<String>,
}

/// PUT /api/kb/:kb_id/settings
pub async fn update_settings(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Json(req): Json<UpdateSettings>,
) -> AppResult<Json<serde_json::Value>> {
    if kb_access.via_api_key || kb_access.role == WorkspaceRole::Member {
        return Err(AppError::Forbidden("admin required to update settings".into()));
    }

    let kb = &kb_access.kb;
    let updated = db::knowledgebases::update(
        &state.db,
        kb.id,
        req.name.as_deref().unwrap_or(&kb.name),
        req.description.as_deref().unwrap_or(&kb.description),
        req.system_prompt.as_deref().unwrap_or(&kb.system_prompt),
        req.model.as_deref().unwrap_or(&kb.model),
        req.accent_color.as_deref().unwrap_or(&kb.accent_color),
    )
    .await?;

    // Invalidate cached agent if model or prompt changed
    state.rag_cache.invalidate(kb.id).await;

    Ok(Json(serde_json::json!(updated)))
}
