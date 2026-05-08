use sqlx::PgPool;
use uuid::Uuid;

use crate::db;

/// Fire-and-forget audit log — spawns a task so it never blocks the request.
pub fn log(
    pool: PgPool,
    user_id: Option<Uuid>,
    action: &str,
    resource: &str,
    resource_id: Option<Uuid>,
    detail: Option<serde_json::Value>,
) {
    let action = action.to_string();
    let resource = resource.to_string();
    tokio::spawn(async move {
        if let Err(e) = db::audit_logs::insert(
            &pool,
            user_id,
            &action,
            &resource,
            resource_id,
            detail.as_ref(),
            None,
        )
        .await
        {
            tracing::warn!("audit log failed: {e}");
        }
    });
}
