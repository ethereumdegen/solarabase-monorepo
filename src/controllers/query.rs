use axum::extract::State;
use axum::Json;
use serde::Deserialize;

use crate::auth::extractors::KbAccess;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::middleware::plan_limits;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct QueryRequest {
    pub question: String,
    pub session_id: Option<uuid::Uuid>,
}

/// POST /api/kb/:kb_id/query
pub async fn query(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Json(req): Json<QueryRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if req.question.trim().is_empty() || req.question.len() > 32_000 {
        return Err(AppError::BadRequest("question must be 1-32000 characters".into()));
    }

    plan_limits::check_query_limit(&state.db, kb_access.kb.id, kb_access.kb.owner_id).await?;

    tracing::info!(kb_id = %kb_access.kb.id, "query received");

    let agent = state
        .rag_cache
        .get_agent(&kb_access.kb)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // If session provided, include conversation history for multi-turn context
    let response = if let Some(sid) = req.session_id {
        let history = db::chat_sessions::get_recent_messages(&state.db, sid, 20).await?;
        agent
            .query_with_history(&req.question, &history)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
    } else {
        agent
            .query(&req.question)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
    };

    // Track usage
    db::subscriptions::increment_usage(&state.db, kb_access.kb.id, kb_access.kb.owner_id, "queries").await?;

    // Persist to chat session if provided
    if let Some(session_id) = req.session_id {
        let meta = serde_json::json!({
            "reasoning_path": response.reasoning_path,
            "tools_used": response.tools_used,
        });
        db::chat_sessions::add_message(
            &state.db,
            session_id,
            crate::models::chat_session::ChatRole::User,
            &req.question,
            None,
        )
        .await?;
        db::chat_sessions::add_message(
            &state.db,
            session_id,
            crate::models::chat_session::ChatRole::Assistant,
            &response.answer,
            Some(&meta),
        )
        .await?;
    }

    Ok(Json(serde_json::json!(response)))
}
