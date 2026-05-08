use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;

use crate::auth::extractors::{AuthUser, KbAccess};
use crate::db;
use crate::error::{AppError, AppResult};
use crate::middleware::plan_limits;
use crate::models::knowledgebase::KbRole;
use crate::services::{audit, s3};
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

/// GET /api/kbs — list all accessible KBs
pub async fn list(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let kbs = db::knowledgebases::list_accessible(&state.db, user.id).await?;
    Ok(Json(serde_json::json!(kbs)))
}

/// POST /api/kbs — create new KB
pub async fn create(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateKb>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    if req.name.trim().is_empty() || req.name.len() > 100 {
        return Err(AppError::BadRequest("name must be 1-100 characters".into()));
    }
    validate_slug(&req.slug)?;
    if let Some(ref desc) = req.description {
        if desc.len() > 500 {
            return Err(AppError::BadRequest("description must be at most 500 characters".into()));
        }
    }

    // Users can have 1 free KB + unlimited paid KBs.
    // Block creation only if all existing KBs are on the free tier.
    plan_limits::check_free_kb_limit(&state.db, user.id).await?;

    let default_model = db::app_settings::get(&state.db, "default_kb_model")
        .await?
        .unwrap_or_else(|| "gpt-5.4".to_string());

    let kb = db::knowledgebases::create(
        &state.db,
        user.id,
        &req.name,
        &req.slug,
        req.description.as_deref().unwrap_or(""),
        &default_model,
    )
    .await
    .map_err(|e| {
        if let AppError::Database(ref db_err) = e {
            let msg = db_err.to_string();
            if msg.contains("duplicate key") || msg.contains("unique constraint") {
                return AppError::BadRequest("slug already exists".into());
            }
        }
        e
    })?;

    // Create a free subscription for the new KB
    db::subscriptions::get_or_create_free(&state.db, kb.id, user.id).await?;

    audit::log(
        state.db.clone(), Some(user.id), "create_kb", "knowledgebase", Some(kb.id),
        Some(serde_json::json!({ "slug": kb.slug })),
    );

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
    if !kb_access.can_admin() {
        return Err(AppError::Forbidden("admin required to delete KB".into()));
    }

    // Delete all S3 objects for this KB's documents
    let docs = db::documents::list_for_kb(&state.db, kb_access.kb.id).await?;
    if let Some(bucket) = &state.bucket {
        for doc in &docs {
            if let Err(e) = s3::delete_object(bucket, &doc.s3_key).await {
                tracing::warn!(doc_id = %doc.id, error = %e, "failed to delete S3 object during KB deletion");
            }
        }
    }

    // Invalidate RAG cache
    state.rag_cache.invalidate(kb_access.kb.id).await;

    // Delete from DB (cascades to documents, page_indexes, document_indexes, api_keys, chat_sessions)
    db::knowledgebases::delete(&state.db, kb_access.kb.id).await?;

    audit::log(
        state.db.clone(), Some(kb_access.user.id), "delete_kb", "knowledgebase", Some(kb_access.kb.id),
        Some(serde_json::json!({ "docs_deleted": docs.len() })),
    );

    tracing::info!(kb_id = %kb_access.kb.id, docs_deleted = docs.len(), "knowledgebase deleted");
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct InviteRequest {
    pub email: String,
    pub role: Option<KbRole>,
}

/// POST /api/kb/:kb_id/invite — invite someone to a KB
pub async fn invite(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Json(req): Json<InviteRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    if !kb_access.can_admin() {
        return Err(AppError::Forbidden("admin required to invite".into()));
    }
    if req.email.trim().is_empty() || req.email.len() > 254 {
        return Err(AppError::BadRequest("invalid email".into()));
    }

    plan_limits::check_member_limit(&state.db, kb_access.kb.id, kb_access.kb.owner_id).await?;

    let role = req.role.unwrap_or(KbRole::Editor);
    let token = hex::encode(rand::random::<[u8; 16]>());
    let inv = db::invitations::create(&state.db, kb_access.kb.id, &req.email, &role, kb_access.user.id, &token).await?;

    audit::log(
        state.db.clone(), Some(kb_access.user.id), "invite_member", "knowledgebase", Some(kb_access.kb.id),
        Some(serde_json::json!({ "email": req.email, "role": role })),
    );

    Ok((StatusCode::CREATED, Json(serde_json::json!(inv))))
}

#[derive(Deserialize)]
pub struct AcceptInviteParams {
    pub token: String,
}

/// POST /api/invitations/accept?token=X
pub async fn accept_invite(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<AcceptInviteParams>,
) -> AppResult<Json<serde_json::Value>> {
    let inv = db::invitations::get_by_token(&state.db, &params.token)
        .await?
        .ok_or_else(|| AppError::NotFound("invitation not found or expired".into()))?;

    // Add as KB member with the invited role
    db::knowledgebases::add_kb_member(&state.db, inv.kb_id, user.id, &inv.role).await?;
    db::invitations::accept(&state.db, inv.id).await?;

    let kb = db::knowledgebases::get_by_id(&state.db, inv.kb_id)
        .await?
        .ok_or_else(|| AppError::NotFound("knowledgebase not found".into()))?;

    Ok(Json(serde_json::json!(kb)))
}
