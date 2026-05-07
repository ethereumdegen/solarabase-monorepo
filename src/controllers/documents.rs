use axum::extract::{Multipart, Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::extractors::KbAccess;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::middleware::plan_limits;
use crate::services::s3;
use crate::state::AppState;

/// POST /api/kb/:kb_id/documents
pub async fn upload(
    kb_access: KbAccess,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> AppResult<(StatusCode, Json<Value>)> {
    let mut file_data: Option<(String, String, Vec<u8>)> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            let filename = field
                .file_name()
                .unwrap_or("unknown")
                .to_string();
            let content_type = field
                .content_type()
                .unwrap_or("application/octet-stream")
                .to_string();
            let bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(e.to_string()))?;
            file_data = Some((filename, content_type, bytes.to_vec()));
        }
    }

    let (filename, content_type, bytes) =
        file_data.ok_or_else(|| AppError::BadRequest("no file field in upload".into()))?;

    let size_bytes = bytes.len() as i64;

    // Plan limits
    plan_limits::check_doc_limit(&state.db, kb_access.kb.workspace_id, kb_access.kb.id).await?;
    plan_limits::check_file_size(&state.db, kb_access.kb.workspace_id, size_bytes).await?;

    let s3_key = format!("{}/documents/{}/{}", kb_access.kb.id, Uuid::new_v4(), filename);

    s3::upload_bytes(&state.bucket, &s3_key, &bytes, &content_type).await?;

    let doc = db::documents::insert(
        &state.db,
        kb_access.kb.id,
        &filename,
        &content_type,
        &s3_key,
        size_bytes,
        kb_access.user.id,
    )
    .await?;

    tracing::info!(doc_id = %doc.id, kb_id = %kb_access.kb.id, filename = %doc.filename, "document uploaded");

    Ok((StatusCode::CREATED, Json(json!(doc))))
}

/// GET /api/kb/:kb_id/documents
pub async fn list(
    kb_access: KbAccess,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    let docs = db::documents::list_for_kb(&state.db, kb_access.kb.id).await?;
    Ok(Json(json!(docs)))
}

/// GET /api/kb/:kb_id/documents/:id
pub async fn get(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Path((_kb_id, id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<Value>> {
    let doc = db::documents::get_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("document {id} not found")))?;
    if doc.kb_id != kb_access.kb.id {
        return Err(AppError::NotFound("document not found in this KB".into()));
    }
    Ok(Json(json!(doc)))
}

/// DELETE /api/kb/:kb_id/documents/:id
pub async fn delete(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Path((_kb_id, id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    let doc = db::documents::get_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("document {id} not found")))?;
    if doc.kb_id != kb_access.kb.id {
        return Err(AppError::NotFound("document not found in this KB".into()));
    }

    // Delete DB first (cascades page_indexes etc), then S3
    db::documents::delete(&state.db, id).await?;
    if let Err(e) = s3::delete_object(&state.bucket, &doc.s3_key).await {
        tracing::warn!(doc_id = %id, error = %e, "failed to delete S3 object after DB delete");
    }

    tracing::info!(doc_id = %id, kb_id = %kb_access.kb.id, "document deleted");
    Ok(StatusCode::NO_CONTENT)
}
