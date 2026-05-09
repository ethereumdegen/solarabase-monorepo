use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct LlmLog {
    pub id: Uuid,
    pub kb_id: Option<Uuid>,
    pub session_id: Option<Uuid>,
    pub request_type: String,
    pub model: String,
    pub input_chars: i32,
    pub output_chars: i32,
    pub latency_ms: i32,
    pub status: String,
    pub error_msg: Option<String>,
    pub created_at: DateTime<Utc>,
}
