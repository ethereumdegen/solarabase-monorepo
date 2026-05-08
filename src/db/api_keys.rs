use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::api_key::ApiKey;

pub async fn create(
    pool: &PgPool,
    kb_id: Uuid,
    name: &str,
    key_hash: &str,
    key_prefix: &str,
    created_by: Uuid,
) -> AppResult<ApiKey> {
    let key = sqlx::query_as::<_, ApiKey>(
        r#"
        INSERT INTO api_keys (kb_id, name, key_hash, key_prefix, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(kb_id)
    .bind(name)
    .bind(key_hash)
    .bind(key_prefix)
    .bind(created_by)
    .fetch_one(pool)
    .await?;
    Ok(key)
}

pub async fn list_for_kb(pool: &PgPool, kb_id: Uuid) -> AppResult<Vec<ApiKey>> {
    let keys = sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM api_keys WHERE kb_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) ORDER BY created_at DESC",
    )
    .bind(kb_id)
    .fetch_all(pool)
    .await?;
    Ok(keys)
}

pub async fn count_for_kb(pool: &PgPool, kb_id: Uuid) -> AppResult<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM api_keys WHERE kb_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())",
    )
    .bind(kb_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn revoke(pool: &PgPool, id: Uuid) -> AppResult<bool> {
    let result = sqlx::query(
        "UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn validate_key(pool: &PgPool, key_hash: &str) -> AppResult<Option<ApiKey>> {
    let key = sqlx::query_as::<_, ApiKey>(
        r#"
        UPDATE api_keys SET last_used_at = now()
        WHERE key_hash = $1
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        RETURNING *
        "#,
    )
    .bind(key_hash)
    .fetch_optional(pool)
    .await?;
    Ok(key)
}
