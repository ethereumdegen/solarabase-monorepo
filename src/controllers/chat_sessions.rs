use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::extractors::KbAccess;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreateSession {
    pub title: Option<String>,
}

/// POST /api/kb/:kb_id/sessions
pub async fn create_session(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Json(req): Json<CreateSession>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let title = req.title.as_deref().unwrap_or("New Chat");
    let session = db::chat_sessions::create_session(
        &state.db,
        kb_access.kb.id,
        kb_access.user.id,
        title,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(serde_json::json!(session))))
}

/// GET /api/kb/:kb_id/sessions
pub async fn list_sessions(
    kb_access: KbAccess,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let sessions = db::chat_sessions::list_sessions(
        &state.db,
        kb_access.kb.id,
        kb_access.user.id,
    )
    .await?;
    Ok(Json(serde_json::json!(sessions)))
}

/// GET /api/kb/:kb_id/sessions/:sid
pub async fn get_session(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Path((_kb_id, sid)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let session = db::chat_sessions::get_session(&state.db, sid)
        .await?
        .ok_or_else(|| AppError::NotFound("session not found".into()))?;

    // Verify session belongs to this KB and user
    if session.kb_id != kb_access.kb.id || session.user_id != kb_access.user.id {
        return Err(AppError::NotFound("session not found".into()));
    }

    let messages = db::chat_sessions::get_messages(&state.db, sid).await?;
    Ok(Json(serde_json::json!({
        "session": session,
        "messages": messages,
    })))
}

#[derive(Deserialize)]
pub struct SendMessage {
    pub content: String,
}

/// POST /api/kb/:kb_id/sessions/:sid/messages
pub async fn send_message(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Path((_kb_id, sid)): Path<(Uuid, Uuid)>,
    Json(req): Json<SendMessage>,
) -> AppResult<Json<serde_json::Value>> {
    // Verify session ownership
    let session = db::chat_sessions::get_session(&state.db, sid)
        .await?
        .ok_or_else(|| AppError::NotFound("session not found".into()))?;
    if session.kb_id != kb_access.kb.id || session.user_id != kb_access.user.id {
        return Err(AppError::NotFound("session not found".into()));
    }

    // Check limit before saving anything
    crate::middleware::plan_limits::check_query_limit(&state.db, kb_access.kb.id, kb_access.kb.owner_id).await?;

    // Save user message
    db::chat_sessions::add_message(
        &state.db,
        sid,
        crate::models::chat_session::ChatRole::User,
        &req.content,
        None,
    )
    .await?;

    let agent = state
        .rag_cache
        .get_agent(&kb_access.kb)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let response = agent
        .query(&req.content)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    db::subscriptions::increment_usage(&state.db, kb_access.kb.id, kb_access.kb.owner_id, "queries").await?;

    let meta = serde_json::json!({
        "reasoning_path": response.reasoning_path,
        "tools_used": response.tools_used,
    });

    let msg = db::chat_sessions::add_message(
        &state.db,
        sid,
        crate::models::chat_session::ChatRole::Assistant,
        &response.answer,
        Some(&meta),
    )
    .await?;

    Ok(Json(serde_json::json!(msg)))
}
