use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::invitation::Invitation;
use crate::models::knowledgebase::KbRole;

pub async fn create(
    pool: &PgPool,
    kb_id: Uuid,
    email: &str,
    role: &KbRole,
    invited_by: Uuid,
    token: &str,
) -> AppResult<Invitation> {
    let expires_at = chrono::Utc::now() + chrono::Duration::days(7);
    let inv = sqlx::query_as::<_, Invitation>(
        r#"
        INSERT INTO invitations (kb_id, email, role, invited_by, token, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (kb_id, email) DO UPDATE
        SET role = EXCLUDED.role, token = EXCLUDED.token,
            expires_at = EXCLUDED.expires_at, accepted_at = NULL
        RETURNING *
        "#,
    )
    .bind(kb_id)
    .bind(email)
    .bind(role)
    .bind(invited_by)
    .bind(token)
    .bind(expires_at)
    .fetch_one(pool)
    .await?;
    Ok(inv)
}

pub async fn get_by_token(pool: &PgPool, token: &str) -> AppResult<Option<Invitation>> {
    let inv = sqlx::query_as::<_, Invitation>(
        "SELECT * FROM invitations WHERE token = $1 AND accepted_at IS NULL AND expires_at > now()",
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;
    Ok(inv)
}

pub async fn accept(pool: &PgPool, id: Uuid) -> AppResult<()> {
    sqlx::query("UPDATE invitations SET accepted_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_for_kb(
    pool: &PgPool,
    kb_id: Uuid,
) -> AppResult<Vec<Invitation>> {
    let invs = sqlx::query_as::<_, Invitation>(
        "SELECT * FROM invitations WHERE kb_id = $1 ORDER BY created_at DESC",
    )
    .bind(kb_id)
    .fetch_all(pool)
    .await?;
    Ok(invs)
}
