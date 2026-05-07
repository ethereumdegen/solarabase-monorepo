use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::knowledgebase::{KbMemberWithUser, KbMembership, KbRole, Knowledgebase};

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

// -- KB-level memberships --

pub async fn get_kb_membership(
    pool: &PgPool,
    kb_id: Uuid,
    user_id: Uuid,
) -> AppResult<Option<KbMembership>> {
    let m = sqlx::query_as::<_, KbMembership>(
        "SELECT * FROM kb_memberships WHERE kb_id = $1 AND user_id = $2",
    )
    .bind(kb_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(m)
}

pub async fn kb_has_memberships(pool: &PgPool, kb_id: Uuid) -> AppResult<bool> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM kb_memberships WHERE kb_id = $1",
    )
    .bind(kb_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0 > 0)
}

pub async fn list_kb_members(
    pool: &PgPool,
    kb_id: Uuid,
) -> AppResult<Vec<KbMemberWithUser>> {
    let members = sqlx::query_as::<_, KbMemberWithUser>(
        r#"
        SELECT u.id AS user_id, u.email, u.name, u.avatar_url, km.role
        FROM kb_memberships km
        JOIN users u ON u.id = km.user_id
        WHERE km.kb_id = $1
        ORDER BY km.created_at
        "#,
    )
    .bind(kb_id)
    .fetch_all(pool)
    .await?;
    Ok(members)
}

pub async fn add_kb_member(
    pool: &PgPool,
    kb_id: Uuid,
    user_id: Uuid,
    role: &KbRole,
) -> AppResult<KbMembership> {
    let m = sqlx::query_as::<_, KbMembership>(
        r#"
        INSERT INTO kb_memberships (kb_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (kb_id, user_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING *
        "#,
    )
    .bind(kb_id)
    .bind(user_id)
    .bind(role)
    .fetch_one(pool)
    .await?;
    Ok(m)
}

pub async fn remove_kb_member(
    pool: &PgPool,
    kb_id: Uuid,
    user_id: Uuid,
) -> AppResult<bool> {
    let result = sqlx::query(
        "DELETE FROM kb_memberships WHERE kb_id = $1 AND user_id = $2",
    )
    .bind(kb_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}
