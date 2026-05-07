use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::extractors::KbAccess;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::models::knowledgebase::KbRole;
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
    pub accent_color: Option<String>,
}

/// PUT /api/kb/:kb_id/settings
pub async fn update_settings(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Json(req): Json<UpdateSettings>,
) -> AppResult<Json<serde_json::Value>> {
    require_kb_admin(&kb_access)?;

    let kb = &kb_access.kb;
    let updated = db::knowledgebases::update(
        &state.db,
        kb.id,
        req.name.as_deref().unwrap_or(&kb.name),
        req.description.as_deref().unwrap_or(&kb.description),
        req.accent_color.as_deref().unwrap_or(&kb.accent_color),
    )
    .await?;

    Ok(Json(serde_json::json!(updated)))
}

fn require_kb_admin(kb_access: &KbAccess) -> AppResult<()> {
    if kb_access.via_api_key {
        return Err(AppError::Forbidden("not available via API key".into()));
    }
    // Workspace owner/admin always has access
    if kb_access.role == WorkspaceRole::Owner || kb_access.role == WorkspaceRole::Admin {
        return Ok(());
    }
    // KB-level admin
    if kb_access.kb_role == Some(KbRole::Admin) {
        return Ok(());
    }
    Err(AppError::Forbidden("admin required".into()))
}

/// GET /api/kb/:kb_id/members
pub async fn list_kb_members(
    kb_access: KbAccess,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let members = db::knowledgebases::list_kb_members(&state.db, kb_access.kb.id).await?;
    Ok(Json(serde_json::json!(members)))
}

#[derive(Debug, Deserialize)]
pub struct AddKbMember {
    pub email: String,
    pub role: Option<KbRole>,
}

/// POST /api/kb/:kb_id/members
pub async fn add_kb_member(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Json(req): Json<AddKbMember>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    require_kb_admin(&kb_access)?;

    // Find user by email
    let target_user = db::users::get_by_email(&state.db, &req.email)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("user '{}' not found", req.email)))?;

    // Must be a workspace member
    let _ws_membership = db::workspaces::get_membership(&state.db, kb_access.kb.workspace_id, target_user.id)
        .await?
        .ok_or_else(|| AppError::BadRequest("user must be a workspace member first".into()))?;

    let role = req.role.unwrap_or(KbRole::Viewer);
    let membership = db::knowledgebases::add_kb_member(&state.db, kb_access.kb.id, target_user.id, &role).await?;

    Ok((StatusCode::CREATED, Json(serde_json::json!(membership))))
}

/// DELETE /api/kb/:kb_id/members/:user_id
pub async fn remove_kb_member(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Path((_kb_id, user_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    require_kb_admin(&kb_access)?;
    db::knowledgebases::remove_kb_member(&state.db, kb_access.kb.id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
