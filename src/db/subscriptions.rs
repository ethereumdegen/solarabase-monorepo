use chrono::Datelike;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::subscription::{PlanTier, Subscription};

pub async fn get_or_create_free(pool: &PgPool, kb_id: Uuid, user_id: Uuid) -> AppResult<Subscription> {
    // Try to get existing
    if let Some(sub) = get_for_kb(pool, kb_id).await? {
        return Ok(sub);
    }

    // Create free tier
    let sub = sqlx::query_as::<_, Subscription>(
        r#"
        INSERT INTO subscriptions (kb_id, user_id, plan, status)
        VALUES ($1, $2, 'free', 'active')
        ON CONFLICT (kb_id) DO UPDATE SET updated_at = now()
        RETURNING *
        "#,
    )
    .bind(kb_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(sub)
}

pub async fn get_for_kb(
    pool: &PgPool,
    kb_id: Uuid,
) -> AppResult<Option<Subscription>> {
    let sub = sqlx::query_as::<_, Subscription>(
        "SELECT * FROM subscriptions WHERE kb_id = $1",
    )
    .bind(kb_id)
    .fetch_optional(pool)
    .await?;
    Ok(sub)
}

pub async fn update_from_stripe(
    pool: &PgPool,
    kb_id: Uuid,
    plan: &PlanTier,
    stripe_customer_id: &str,
    stripe_subscription_id: &str,
    current_period_end: Option<chrono::DateTime<chrono::Utc>>,
) -> AppResult<Subscription> {
    let sub = sqlx::query_as::<_, Subscription>(
        r#"
        UPDATE subscriptions
        SET plan = $2, stripe_customer_id = $3, stripe_subscription_id = $4,
            status = 'active', current_period_end = $5, updated_at = now()
        WHERE kb_id = $1
        RETURNING *
        "#,
    )
    .bind(kb_id)
    .bind(plan)
    .bind(stripe_customer_id)
    .bind(stripe_subscription_id)
    .bind(current_period_end)
    .fetch_one(pool)
    .await?;
    Ok(sub)
}

pub async fn cancel(pool: &PgPool, stripe_subscription_id: &str) -> AppResult<()> {
    sqlx::query(
        "UPDATE subscriptions SET status = 'canceled', updated_at = now() WHERE stripe_subscription_id = $1",
    )
    .bind(stripe_subscription_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_plan_for_kb(pool: &PgPool, kb_id: Uuid, owner_id: Uuid) -> AppResult<PlanTier> {
    let sub = get_or_create_free(pool, kb_id, owner_id).await?;
    Ok(sub.plan)
}

/// Count how many KBs a user owns that have a free-tier subscription.
pub async fn count_free_kbs_for_user(pool: &PgPool, user_id: Uuid) -> AppResult<i64> {
    let row: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM subscriptions s
        JOIN knowledgebases k ON k.id = s.kb_id
        WHERE k.owner_id = $1 AND s.plan = 'free' AND s.status = 'active'
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

fn monthly_period() -> (chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>) {
    let now = chrono::Utc::now();
    let first_of_month = now
        .date_naive()
        .with_day(1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    let period_start =
        chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(first_of_month, chrono::Utc);
    let next_month = if now.month() == 12 {
        chrono::NaiveDate::from_ymd_opt(now.year() + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(now.year(), now.month() + 1, 1).unwrap()
    };
    let period_end = chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(
        next_month.and_hms_opt(0, 0, 0).unwrap(),
        chrono::Utc,
    );
    (period_start, period_end)
}

pub async fn increment_usage(
    pool: &PgPool,
    kb_id: Uuid,
    user_id: Uuid,
    metric: &str,
) -> AppResult<i64> {
    let (period_start, period_end) = monthly_period();

    let row: (i64,) = sqlx::query_as(
        r#"
        INSERT INTO usage_records (kb_id, user_id, metric, value, period_start, period_end)
        VALUES ($1, $2, $3, 1, $4, $5)
        ON CONFLICT (kb_id, metric, period_start)
        DO UPDATE SET value = usage_records.value + 1
        RETURNING value
        "#,
    )
    .bind(kb_id)
    .bind(user_id)
    .bind(metric)
    .bind(period_start)
    .bind(period_end)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn get_usage(
    pool: &PgPool,
    kb_id: Uuid,
    metric: &str,
) -> AppResult<i64> {
    let (period_start, _) = monthly_period();

    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT value FROM usage_records WHERE kb_id = $1 AND metric = $2 AND period_start = $3",
    )
    .bind(kb_id)
    .bind(metric)
    .bind(period_start)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| r.0).unwrap_or(0))
}
