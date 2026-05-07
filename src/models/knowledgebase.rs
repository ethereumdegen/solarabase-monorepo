use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Knowledgebase {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub system_prompt: String,
    pub model: String,
    pub accent_color: String,
    pub logo_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "kb_role", rename_all = "lowercase")]
pub enum KbRole {
    Viewer,
    Editor,
    Admin,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct KbMembership {
    pub id: Uuid,
    pub kb_id: Uuid,
    pub user_id: Uuid,
    pub role: KbRole,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct KbMemberWithUser {
    pub user_id: Uuid,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: KbRole,
}
