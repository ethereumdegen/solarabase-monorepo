use axum::extract::State;
use axum::Json;
use serde::Deserialize;

use crate::auth::extractors::KbAccess;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::middleware::plan_limits;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct RetrieveRequest {
    pub query: String,
    pub max_pages: Option<usize>,
}

/// POST /api/kb/:kb_id/retrieve — RAG only, no LLM synthesis
pub async fn retrieve(
    kb_access: KbAccess,
    State(state): State<AppState>,
    Json(req): Json<RetrieveRequest>,
) -> AppResult<Json<serde_json::Value>> {
    plan_limits::check_query_limit(&state.db, kb_access.kb.id, kb_access.kb.owner_id).await?;

    let max_pages = req.max_pages.unwrap_or(10);
    let documents = state
        .rag_cache
        .retrieve(kb_access.kb.id, &req.query, max_pages)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    db::subscriptions::increment_usage(&state.db, kb_access.kb.id, kb_access.kb.owner_id, "queries").await?;

    Ok(Json(serde_json::json!({ "documents": documents })))
}
