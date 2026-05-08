use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "plan_tier", rename_all = "lowercase")]
pub enum PlanTier {
    Free,
    Pro,
    Team,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "subscription_status", rename_all = "snake_case")]
pub enum SubscriptionStatus {
    Active,
    Canceled,
    PastDue,
    Trialing,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Subscription {
    pub id: Uuid,
    pub user_id: Uuid,
    pub kb_id: Uuid,
    pub plan: PlanTier,
    pub stripe_customer_id: Option<String>,
    pub stripe_subscription_id: Option<String>,
    pub status: SubscriptionStatus,
    pub current_period_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct UsageRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub kb_id: Uuid,
    pub metric: String,
    pub value: i64,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
}

impl PlanTier {
    pub fn max_docs_per_kb(&self) -> Option<i64> {
        match self {
            PlanTier::Free => Some(50),
            PlanTier::Pro => None,
            PlanTier::Team => None,
        }
    }

    pub fn max_queries_per_month(&self) -> Option<i64> {
        match self {
            PlanTier::Free => Some(1000),
            PlanTier::Pro => Some(5000),
            PlanTier::Team => None,
        }
    }

    pub fn max_members(&self) -> Option<i64> {
        match self {
            PlanTier::Free => Some(2),
            PlanTier::Pro => Some(5),
            PlanTier::Team => None,
        }
    }

    pub fn max_file_size_bytes(&self) -> i64 {
        match self {
            PlanTier::Free => 100 * 1024 * 1024,
            PlanTier::Pro => 500 * 1024 * 1024,
            PlanTier::Team => 1024 * 1024 * 1024,
        }
    }
}

/// Max number of free-tier KBs a single user can have.
pub fn max_free_kbs_per_user() -> i64 {
    1
}
