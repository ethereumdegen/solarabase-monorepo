use sqlx::PgPool;

use crate::error::AppResult;
use crate::models::app_setting::AppSetting;

pub async fn get(pool: &PgPool, key: &str) -> AppResult<Option<String>> {
    let row = sqlx::query_scalar::<_, String>(
        "SELECT value FROM app_settings WHERE key = $1",
    )
    .bind(key)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn get_all(pool: &PgPool) -> AppResult<Vec<AppSetting>> {
    let settings = sqlx::query_as::<_, AppSetting>(
        "SELECT * FROM app_settings ORDER BY key",
    )
    .fetch_all(pool)
    .await?;
    Ok(settings)
}

pub async fn set(pool: &PgPool, key: &str, value: &str) -> AppResult<AppSetting> {
    let setting = sqlx::query_as::<_, AppSetting>(
        r#"
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ($1, $2, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        RETURNING *
        "#,
    )
    .bind(key)
    .bind(value)
    .fetch_one(pool)
    .await?;
    Ok(setting)
}
