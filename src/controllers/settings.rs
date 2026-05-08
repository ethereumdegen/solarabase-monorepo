use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::extractors::KbAccess;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::models::knowledgebase::KbRole;
use crate::services::audit;
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

    if let Some(ref name) = req.name {
        if name.trim().is_empty() || name.len() > 100 {
            return Err(AppError::BadRequest("name must be 1-100 characters".into()));
        }
    }
    if let Some(ref desc) = req.description {
        if desc.len() > 500 {
            return Err(AppError::BadRequest("description must be at most 500 characters".into()));
        }
    }
    if let Some(ref color) = req.accent_color {
        if color.len() > 20 {
            return Err(AppError::BadRequest("accent_color must be at most 20 characters".into()));
        }
    }

    let kb = &kb_access.kb;
    let updated = db::knowledgebases::update(
        &state.db,
        kb.id,
        req.name.as_deref().unwrap_or(&kb.name),
        req.description.as_deref().unwrap_or(&kb.description),
        req.accent_color.as_deref().unwrap_or(&kb.accent_color),
    )
    .await?;

    audit::log(
        state.db.clone(), Some(kb_access.user.id), "update_settings", "knowledgebase", Some(kb_access.kb.id), None,
    );

    Ok(Json(serde_json::json!(updated)))
}

fn require_kb_admin(kb_access: &KbAccess) -> AppResult<()> {
    if !kb_access.can_admin() {
        return Err(AppError::Forbidden("admin required".into()));
    }
    Ok(())
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

    if req.email.trim().is_empty() || req.email.len() > 254 {
        return Err(AppError::BadRequest("invalid email".into()));
    }

    // Find user by email
    let target_user = db::users::get_by_email(&state.db, &req.email)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("user '{}' not found", req.email)))?;

    let role = req.role.unwrap_or(KbRole::Viewer);
    let membership = db::knowledgebases::add_kb_member(&state.db, kb_access.kb.id, target_user.id, &role).await?;

    audit::log(
        state.db.clone(), Some(kb_access.user.id), "add_member", "knowledgebase", Some(kb_access.kb.id),
        Some(serde_json::json!({ "target_email": req.email, "role": role })),
    );

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

    audit::log(
        state.db.clone(), Some(kb_access.user.id), "remove_member", "knowledgebase", Some(kb_access.kb.id),
        Some(serde_json::json!({ "removed_user_id": user_id })),
    );

    Ok(StatusCode::NO_CONTENT)
}
