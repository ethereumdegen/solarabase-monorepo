use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::extractors::{AuthUser, KbAccess};
use crate::db;
use crate::error::{AppError, AppResult};
use crate::middleware::plan_limits;
use crate::models::workspace::WorkspaceRole;
use crate::services::s3;
use crate::state::AppState;

fn validate_slug(slug: &str) -> AppResult<()> {
    if slug.is_empty() || slug.len() > 64 {
        return Err(AppError::BadRequest("slug must be 1-64 characters".into()));
    }
    if !slug.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err(AppError::BadRequest("slug must be lowercase alphanumeric with dashes".into()));
    }
    if slug.starts_with('-') || slug.ends_with('-') {
        return Err(AppError::BadRequest("slug cannot start or end with dash".into()));
    }
    Ok(())
}

#[derive(Deserialize)]
pub struct CreateKb {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
}

pub async fn list(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(ws_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let _membership = db::workspaces::get_membership(&state.db, ws_id, user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("not a member".into()))?;
    let kbs = db::knowledgebases::list_for_workspace(&state.db, ws_id).await?;
    Ok(Json(serde_json::json!(kbs)))
}

pub async fn create(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(ws_id): Path<Uuid>,
    Json(req): Json<CreateKb>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let membership = db::workspaces::get_membership(&state.db, ws_id, user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("not a member".into()))?;
    if membership.role == WorkspaceRole::Member {
        return Err(AppError::Forbidden("admin required to create KB".into()));
    }

    if req.name.trim().is_empty() || req.name.len() > 100 {
        return Err(AppError::BadRequest("name must be 1-100 characters".into()));
    }
    validate_slug(&req.slug)?;

    plan_limits::check_kb_limit(&state.db, ws_id).await?;

    let kb = db::knowledgebases::create(
        &state.db,
        ws_id,
        &req.name,
        &req.slug,
        req.description.as_deref().unwrap_or(""),
    )
    .await
    .map_err(|e| {
        // Handle unique constraint violation gracefully
        if let AppError::Database(ref db_err) = e {
            let msg = db_err.to_string();
            if msg.contains("duplicate key") || msg.contains("unique constraint") {
                return AppError::BadRequest("slug already exists in this workspace".into());
            }
        }
        e
    })?;
    Ok((StatusCode::CREATED, Json(serde_json::json!(kb))))
}

/// GET /api/kb/:kb_id — get KB details
pub async fn get(
    kb_access: KbAccess,
) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!(kb_access.kb)))
}

/// DELETE /api/kb/:kb_id — delete KB + all docs from S3
pub async fn delete(
    kb_access: KbAccess,
    State(state): State<AppState>,
) -> AppResult<StatusCode> {
    if kb_access.via_api_key || kb_access.role == WorkspaceRole::Member {
        return Err(AppError::Forbidden("admin required to delete KB".into()));
    }

    // Delete all S3 objects for this KB's documents
    let docs = db::documents::list_for_kb(&state.db, kb_access.kb.id).await?;
    for doc in &docs {
        if let Err(e) = s3::delete_object(&state.bucket, &doc.s3_key).await {
            tracing::warn!(doc_id = %doc.id, error = %e, "failed to delete S3 object during KB deletion");
        }
    }

    // Invalidate RAG cache
    state.rag_cache.invalidate(kb_access.kb.id).await;

    // Delete from DB (cascades to documents, page_indexes, document_indexes, api_keys, chat_sessions)
    db::knowledgebases::delete(&state.db, kb_access.kb.id).await?;

    tracing::info!(kb_id = %kb_access.kb.id, docs_deleted = docs.len(), "knowledgebase deleted");
    Ok(StatusCode::NO_CONTENT)
}
