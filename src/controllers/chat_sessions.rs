use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::Json;
use futures::stream::Stream;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::extractors::KbAccess;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const MAX_MESSAGE_LENGTH: usize = 32_000;

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
    if let Some(ref t) = req.title {
        if t.len() > 200 {
            return Err(AppError::BadRequest("title must be at most 200 characters".into()));
        }
    }
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

    if req.content.trim().is_empty() || req.content.len() > MAX_MESSAGE_LENGTH {
        return Err(AppError::BadRequest(
            format!("message must be 1-{MAX_MESSAGE_LENGTH} characters"),
        ));
    }

    // Check limit before saving anything
    crate::middleware::plan_limits::check_query_limit(&state.db, kb_access.kb.id, kb_access.kb.owner_id).await?;

    // Update session title from first message if still default
    if session.title == "New Chat" {
        let title = if req.content.len() > 50 {
            let end = req.content.char_indices().nth(50).map(|(i, _)| i).unwrap_or(req.content.len());
            format!("{}...", &req.content[..end])
        } else {
            req.content.clone()
        };
        let _ = db::chat_sessions::update_title(&state.db, sid, &title).await;
    }

    // Save user message
    let user_msg = db::chat_sessions::add_message(
        &state.db,
        sid,
        crate::models::chat_session::ChatRole::User,
        &req.content,
        None,
    )
    .await?;

    // Enqueue job for background worker pool (returns immediately)
    db::chat_jobs::create(
        &state.db,
        sid,
        kb_access.kb.id,
        kb_access.kb.owner_id,
        &req.content,
    )
    .await?;

    Ok(Json(serde_json::json!(user_msg)))
}

/// POST /api/kb/:kb_id/sessions/:sid/stream
/// Send a message and stream agent events via SSE.
pub async fn stream_message(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Path((_kb_id, sid)): Path<(Uuid, Uuid)>,
    Json(req): Json<SendMessage>,
) -> AppResult<Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>> {
    // Verify session ownership
    let session = db::chat_sessions::get_session(&state.db, sid)
        .await?
        .ok_or_else(|| AppError::NotFound("session not found".into()))?;
    if session.kb_id != kb_access.kb.id || session.user_id != kb_access.user.id {
        return Err(AppError::NotFound("session not found".into()));
    }

    if req.content.trim().is_empty() || req.content.len() > MAX_MESSAGE_LENGTH {
        return Err(AppError::BadRequest(
            format!("message must be 1-{MAX_MESSAGE_LENGTH} characters"),
        ));
    }

    crate::middleware::plan_limits::check_query_limit(
        &state.db, kb_access.kb.id, kb_access.kb.owner_id,
    ).await?;

    // Update session title from first message if still default
    if session.title == "New Chat" {
        let title = if req.content.len() > 50 {
            let end = req.content.char_indices().nth(50).map(|(i, _)| i).unwrap_or(req.content.len());
            format!("{}...", &req.content[..end])
        } else {
            req.content.clone()
        };
        let _ = db::chat_sessions::update_title(&state.db, sid, &title).await;
    }

    // Save user message
    db::chat_sessions::add_message(
        &state.db,
        sid,
        crate::models::chat_session::ChatRole::User,
        &req.content,
        None,
    )
    .await?;

    // Get agent and conversation history
    let kb = kb_access.kb;
    let agent = state.rag_cache.get_agent(&kb).await.map_err(|e| {
        AppError::Internal(format!("agent init failed: {e}"))
    })?;

    let history = db::chat_sessions::get_recent_messages(&state.db, sid, 20)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Launch streaming query
    let (mut rx, handle) = agent.query_streaming(&req.content, &history);

    let db = state.db.clone();
    let kb_id = kb.id;
    let owner_id = kb.owner_id;

    let stream = async_stream::stream! {
        // Forward streaming events to SSE
        while let Some(event) = rx.recv().await {
            let json = serde_json::to_string(&event).unwrap_or_default();
            yield Ok(Event::default().data(json));
        }

        // Agent task finished — get result and save to DB
        match handle.await {
            Ok(Ok(response)) => {
                let meta = serde_json::json!({
                    "reasoning_path": response.reasoning_path,
                    "tools_used": response.tools_used,
                });

                if let Err(e) = db::chat_sessions::add_message(
                    &db, sid,
                    crate::models::chat_session::ChatRole::Assistant,
                    &response.answer,
                    Some(&meta),
                ).await {
                    tracing::error!("failed to save assistant message: {e}");
                }

                // Track usage
                let _ = db::subscriptions::increment_usage(&db, kb_id, owner_id, "queries").await;

                // Send final done event with full answer
                let done = serde_json::json!({
                    "type": "complete",
                    "answer": response.answer,
                    "reasoning_path": response.reasoning_path,
                    "tools_used": response.tools_used,
                });
                yield Ok(Event::default().data(done.to_string()));
            }
            Ok(Err(e)) => {
                // Save error as assistant message
                let err_msg = format!("Error: {e}");
                let _ = db::chat_sessions::add_message(
                    &db, sid,
                    crate::models::chat_session::ChatRole::Assistant,
                    &err_msg,
                    None,
                ).await;

                let err = serde_json::json!({ "type": "error", "message": err_msg });
                yield Ok(Event::default().data(err.to_string()));
            }
            Err(e) => {
                let err = serde_json::json!({ "type": "error", "message": format!("task panicked: {e}") });
                yield Ok(Event::default().data(err.to_string()));
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}
