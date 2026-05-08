use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::user::User;

pub async fn upsert_from_google(
    pool: &PgPool,
    google_id: &str,
    email: &str,
    name: &str,
    avatar_url: Option<&str>,
) -> AppResult<User> {
    // Try by google_id first, then fall back to email match (handles dev→google migration)
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (google_id, email, name, avatar_url)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (google_id) DO UPDATE
        SET email = EXCLUDED.email,
            name = EXCLUDED.name,
            avatar_url = EXCLUDED.avatar_url,
            last_login_at = now()
        RETURNING *
        "#,
    )
    .bind(google_id)
    .bind(email)
    .bind(name)
    .bind(avatar_url)
    .fetch_one(pool)
    .await;

    match user {
        Ok(u) => Ok(u),
        Err(_) => {
            // Email already exists with different google_id — update the existing row
            let user = sqlx::query_as::<_, User>(
                r#"
                UPDATE users
                SET google_id = $1, name = $2, avatar_url = $3, last_login_at = now()
                WHERE email = $4
                RETURNING *
                "#,
            )
            .bind(google_id)
            .bind(name)
            .bind(avatar_url)
            .bind(email)
            .fetch_one(pool)
            .await?;
            Ok(user)
        }
    }
}

pub async fn get_by_id(pool: &PgPool, id: Uuid) -> AppResult<Option<User>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(user)
}

pub async fn get_by_email(pool: &PgPool, email: &str) -> AppResult<Option<User>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(email)
        .fetch_optional(pool)
        .await?;
    Ok(user)
}

pub async fn list_all(pool: &PgPool) -> AppResult<Vec<User>> {
    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(users)
}

pub async fn list_paginated(pool: &PgPool, limit: i64, offset: i64) -> AppResult<Vec<User>> {
    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    Ok(users)
}

pub async fn count(pool: &PgPool) -> AppResult<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}
