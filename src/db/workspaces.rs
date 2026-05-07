use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::workspace::{MemberWithUser, Membership, Workspace, WorkspaceRole};

pub async fn create(
    pool: &PgPool,
    name: &str,
    slug: &str,
    owner_id: Uuid,
) -> AppResult<Workspace> {
    let ws = sqlx::query_as::<_, Workspace>(
        r#"
        INSERT INTO workspaces (name, slug, owner_id)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(slug)
    .bind(owner_id)
    .fetch_one(pool)
    .await?;

    // Add owner as member
    sqlx::query(
        "INSERT INTO memberships (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
    )
    .bind(ws.id)
    .bind(owner_id)
    .execute(pool)
    .await?;

    Ok(ws)
}

pub async fn get_by_id(pool: &PgPool, id: Uuid) -> AppResult<Option<Workspace>> {
    let ws = sqlx::query_as::<_, Workspace>("SELECT * FROM workspaces WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(ws)
}

pub async fn list_for_user(pool: &PgPool, user_id: Uuid) -> AppResult<Vec<Workspace>> {
    let workspaces = sqlx::query_as::<_, Workspace>(
        r#"
        SELECT w.* FROM workspaces w
        JOIN memberships m ON m.workspace_id = w.id
        WHERE m.user_id = $1
        ORDER BY w.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(workspaces)
}

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    name: &str,
) -> AppResult<Workspace> {
    let ws = sqlx::query_as::<_, Workspace>(
        "UPDATE workspaces SET name = $2, updated_at = now() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(name)
    .fetch_one(pool)
    .await?;
    Ok(ws)
}

pub async fn delete(pool: &PgPool, id: Uuid) -> AppResult<bool> {
    let result = sqlx::query("DELETE FROM workspaces WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn get_membership(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> AppResult<Option<Membership>> {
    let m = sqlx::query_as::<_, Membership>(
        "SELECT * FROM memberships WHERE workspace_id = $1 AND user_id = $2",
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(m)
}

pub async fn list_members(
    pool: &PgPool,
    workspace_id: Uuid,
) -> AppResult<Vec<MemberWithUser>> {
    let members = sqlx::query_as::<_, MemberWithUser>(
        r#"
        SELECT u.id AS user_id, u.email, u.name, u.avatar_url, m.role
        FROM memberships m
        JOIN users u ON u.id = m.user_id
        WHERE m.workspace_id = $1
        ORDER BY m.created_at
        "#,
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;
    Ok(members)
}

pub async fn add_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    role: &WorkspaceRole,
) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO memberships (workspace_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    )
    .bind(workspace_id)
    .bind(user_id)
    .bind(role)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn remove_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> AppResult<bool> {
    let result = sqlx::query(
        "DELETE FROM memberships WHERE workspace_id = $1 AND user_id = $2 AND role != 'owner'",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn member_count(pool: &PgPool, workspace_id: Uuid) -> AppResult<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM memberships WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}
