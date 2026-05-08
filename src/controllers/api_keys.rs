use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::api_key::generate_api_key;
use crate::auth::extractors::KbAccess;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::middleware::plan_limits;
use crate::services::audit;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreateApiKey {
    pub name: String,
}

/// GET /api/kb/:kb_id/api-keys
pub async fn list(
    kb_access: KbAccess,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    if !kb_access.can_admin() {
        return Err(AppError::Forbidden("admin required to manage API keys".into()));
    }

    let keys = db::api_keys::list_for_kb(&state.db, kb_access.kb.id).await?;

    // Return without the hash, only prefix
    let keys_safe: Vec<serde_json::Value> = keys
        .iter()
        .map(|k| {
            serde_json::json!({
                "id": k.id,
                "name": k.name,
                "key_prefix": k.key_prefix,
                "created_at": k.created_at,
                "last_used_at": k.last_used_at,
                "expires_at": k.expires_at,
            })
        })
        .collect();

    Ok(Json(serde_json::json!(keys_safe)))
}

/// POST /api/kb/:kb_id/api-keys — returns full key ONCE
pub async fn create(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Json(req): Json<CreateApiKey>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    if req.name.trim().is_empty() || req.name.len() > 100 {
        return Err(AppError::BadRequest("name must be 1-100 characters".into()));
    }
    if kb_access.via_api_key {
        return Err(AppError::Forbidden("cannot create API keys via API key auth".into()));
    }
    if !kb_access.can_admin() {
        return Err(AppError::Forbidden("admin required".into()));
    }

    plan_limits::check_api_key_limit(&state.db, kb_access.kb.id, kb_access.kb.owner_id).await?;

    let generated = generate_api_key();
    let key = db::api_keys::create(
        &state.db,
        kb_access.kb.id,
        &req.name,
        &generated.key_hash,
        &generated.key_prefix,
        kb_access.user.id,
    )
    .await?;

    audit::log(
        state.db.clone(), Some(kb_access.user.id), "create_api_key", "api_key", Some(key.id),
        Some(serde_json::json!({ "kb_id": kb_access.kb.id, "name": req.name })),
    );

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": key.id,
            "name": key.name,
            "key": generated.raw_key,
            "key_prefix": key.key_prefix,
            "created_at": key.created_at,
        })),
    ))
}

/// DELETE /api/kb/:kb_id/api-keys/:key_id
pub async fn revoke(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Path((_kb_id, key_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    if kb_access.via_api_key {
        return Err(AppError::Forbidden("cannot revoke API keys via API key auth".into()));
    }
    if !kb_access.can_admin() {
        return Err(AppError::Forbidden("admin required".into()));
    }

    db::api_keys::revoke(&state.db, key_id).await?;

    audit::log(
        state.db.clone(), Some(kb_access.user.id), "revoke_api_key", "api_key", Some(key_id),
        Some(serde_json::json!({ "kb_id": kb_access.kb.id })),
    );

    Ok(StatusCode::NO_CONTENT)
}
