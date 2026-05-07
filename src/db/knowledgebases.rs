use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::knowledgebase::Knowledgebase;

pub async fn create(
    pool: &PgPool,
    workspace_id: Uuid,
    name: &str,
    slug: &str,
    description: &str,
) -> AppResult<Knowledgebase> {
    let kb = sqlx::query_as::<_, Knowledgebase>(
        r#"
        INSERT INTO knowledgebases (workspace_id, name, slug, description)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(workspace_id)
    .bind(name)
    .bind(slug)
    .bind(description)
    .fetch_one(pool)
    .await?;
    Ok(kb)
}

pub async fn get_by_id(pool: &PgPool, id: Uuid) -> AppResult<Option<Knowledgebase>> {
    let kb = sqlx::query_as::<_, Knowledgebase>(
        "SELECT * FROM knowledgebases WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(kb)
}

pub async fn list_for_workspace(
    pool: &PgPool,
    workspace_id: Uuid,
) -> AppResult<Vec<Knowledgebase>> {
    let kbs = sqlx::query_as::<_, Knowledgebase>(
        "SELECT * FROM knowledgebases WHERE workspace_id = $1 ORDER BY created_at DESC",
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;
    Ok(kbs)
}

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    name: &str,
    description: &str,
    accent_color: &str,
) -> AppResult<Knowledgebase> {
    let kb = sqlx::query_as::<_, Knowledgebase>(
        r#"
        UPDATE knowledgebases
        SET name = $2, description = $3, accent_color = $4, updated_at = now()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(accent_color)
    .fetch_one(pool)
    .await?;
    Ok(kb)
}

pub async fn delete(pool: &PgPool, id: Uuid) -> AppResult<bool> {
    let result = sqlx::query("DELETE FROM knowledgebases WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn count_for_workspace(pool: &PgPool, workspace_id: Uuid) -> AppResult<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM knowledgebases WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}
