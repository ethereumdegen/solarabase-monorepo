use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use super::knowledgebase::KbRole;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Invitation {
    pub id: Uuid,
    pub kb_id: Uuid,
    pub email: String,
    pub role: KbRole,
    pub invited_by: Uuid,
    pub token: String,
    pub accepted_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}
