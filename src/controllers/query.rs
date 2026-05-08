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
    plan_limits::check_query_limit(&state.db, kb_access.kb.id, kb_access.kb.owner_id).await?;

    tracing::info!(kb_id = %kb_access.kb.id, question = %req.question, "query received");

    let agent = state
        .rag_cache
        .get_agent(&kb_access.kb)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let response = agent
        .query(&req.question)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

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
