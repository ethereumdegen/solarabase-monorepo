use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::audit_log::AuditLog;

/// Insert an audit log entry. Fire-and-forget — callers should not block on errors.
pub async fn insert(
    pool: &PgPool,
    user_id: Option<Uuid>,
    action: &str,
    resource: &str,
    resource_id: Option<Uuid>,
    detail: Option<&serde_json::Value>,
    ip_address: Option<&str>,
) -> AppResult<()> {
    sqlx::query(
        r#"
        INSERT INTO audit_logs (user_id, action, resource, resource_id, detail, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(user_id)
    .bind(action)
    .bind(resource)
    .bind(resource_id)
    .bind(detail)
    .bind(ip_address)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list(
    pool: &PgPool,
    limit: i64,
    offset: i64,
) -> AppResult<Vec<AuditLog>> {
    let logs = sqlx::query_as::<_, AuditLog>(
        "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    Ok(logs)
}

pub async fn count(pool: &PgPool) -> AppResult<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM audit_logs")
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}
