use sqlx::PgPool;
use uuid::Uuid;

use crate::db;
use crate::error::{AppError, AppResult};
use crate::models::subscription::max_free_kbs_per_user;

/// Check whether a user can create another free KB.
/// Users get 1 free KB; unlimited paid KBs.
pub async fn check_free_kb_limit(pool: &PgPool, user_id: Uuid) -> AppResult<()> {
    let max = max_free_kbs_per_user();
    let count = db::subscriptions::count_free_kbs_for_user(pool, user_id).await?;
    if count >= max {
        return Err(AppError::PlanLimitExceeded(format!(
            "Free KB limit reached ({max}). Upgrade an existing KB to create another."
        )));
    }
    Ok(())
}

pub async fn check_doc_limit(pool: &PgPool, kb_id: Uuid, owner_id: Uuid) -> AppResult<()> {
    let plan = db::subscriptions::get_plan_for_kb(pool, kb_id, owner_id).await?;
    if let Some(max) = plan.max_docs_per_kb() {
        let count = db::documents::count_for_kb(pool, kb_id).await?;
        if count >= max {
            return Err(AppError::PlanLimitExceeded(format!(
                "Document limit reached ({max} per KB). Upgrade your plan for more."
            )));
        }
    }
    Ok(())
}

pub async fn check_query_limit(pool: &PgPool, kb_id: Uuid, owner_id: Uuid) -> AppResult<()> {
    let plan = db::subscriptions::get_plan_for_kb(pool, kb_id, owner_id).await?;
    if let Some(max) = plan.max_queries_per_month() {
        let count = db::subscriptions::get_usage(pool, kb_id, "queries").await?;
        if count >= max {
            return Err(AppError::PlanLimitExceeded(format!(
                "Monthly query limit reached ({max}). Upgrade your plan for more."
            )));
        }
    }
    Ok(())
}

pub async fn check_member_limit(pool: &PgPool, kb_id: Uuid, owner_id: Uuid) -> AppResult<()> {
    let plan = db::subscriptions::get_plan_for_kb(pool, kb_id, owner_id).await?;
    if let Some(max) = plan.max_members() {
        let count = db::knowledgebases::kb_member_count(pool, kb_id).await?;
        if count >= max {
            return Err(AppError::PlanLimitExceeded(format!(
                "Member limit reached ({max}). Upgrade your plan for more."
            )));
        }
    }
    Ok(())
}

pub async fn check_file_size(pool: &PgPool, kb_id: Uuid, owner_id: Uuid, size_bytes: i64) -> AppResult<()> {
    let plan = db::subscriptions::get_plan_for_kb(pool, kb_id, owner_id).await?;
    let max = plan.max_file_size_bytes();
    if size_bytes > max {
        let max_mb = max / (1024 * 1024);
        return Err(AppError::PlanLimitExceeded(format!(
            "File too large. Max {max_mb} MB on your plan."
        )));
    }
    Ok(())
}
