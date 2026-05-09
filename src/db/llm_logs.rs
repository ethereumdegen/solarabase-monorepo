use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::llm_log::LlmLog;

pub async fn insert(
    pool: &PgPool,
    kb_id: Option<Uuid>,
    session_id: Option<Uuid>,
    request_type: &str,
    model: &str,
    input_chars: i32,
    output_chars: i32,
    latency_ms: i32,
    status: &str,
    error_msg: Option<&str>,
) -> AppResult<()> {
    sqlx::query(
        r#"
        INSERT INTO llm_logs (kb_id, session_id, request_type, model, input_chars, output_chars, latency_ms, status, error_msg)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(kb_id)
    .bind(session_id)
    .bind(request_type)
    .bind(model)
    .bind(input_chars)
    .bind(output_chars)
    .bind(latency_ms)
    .bind(status)
    .bind(error_msg)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list(
    pool: &PgPool,
    limit: i64,
    offset: i64,
) -> AppResult<Vec<LlmLog>> {
    let logs = sqlx::query_as::<_, LlmLog>(
        "SELECT * FROM llm_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    Ok(logs)
}

pub async fn count(pool: &PgPool) -> AppResult<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM llm_logs")
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

pub async fn stats(pool: &PgPool) -> AppResult<serde_json::Value> {
    let row = sqlx::query_as::<_, (i64, Option<i64>, Option<i64>, Option<f64>)>(
        r#"
        SELECT
            COUNT(*) as total,
            SUM(input_chars) as total_input_chars,
            SUM(output_chars) as total_output_chars,
            AVG(latency_ms)::float8 as avg_latency_ms
        FROM llm_logs
        WHERE created_at > now() - interval '24 hours'
        "#,
    )
    .fetch_one(pool)
    .await?;

    Ok(serde_json::json!({
        "last_24h": {
            "total_calls": row.0,
            "total_input_chars": row.1.unwrap_or(0),
            "total_output_chars": row.2.unwrap_or(0),
            "avg_latency_ms": row.3.unwrap_or(0.0),
        }
    }))
}
