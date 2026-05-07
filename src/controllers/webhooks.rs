use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};

use crate::db;
use crate::error::{AppError, AppResult};
use crate::models::subscription::PlanTier;
use crate::services::stripe as stripe_svc;
use crate::state::AppState;

/// POST /webhooks/stripe
pub async fn stripe_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> AppResult<StatusCode> {
    let sig = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    stripe_svc::verify_webhook_signature(&body, sig, &state.config.stripe_webhook_secret)?;

    let event: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let event_type = event["type"].as_str().unwrap_or("");

    match event_type {
        "checkout.session.completed" => {
            let session = &event["data"]["object"];
            let workspace_id = session["metadata"]["workspace_id"]
                .as_str()
                .and_then(|s| uuid::Uuid::parse_str(s).ok());

            if let Some(ws_id) = workspace_id {
                let customer_id = session["customer"].as_str().unwrap_or("");
                let subscription_id = session["subscription"].as_str().unwrap_or("");

                // Determine plan from metadata (set during checkout) or line items price
                let plan = session["metadata"]["plan"]
                    .as_str()
                    .and_then(|p| match p {
                        "pro" => Some(PlanTier::Pro),
                        "team" => Some(PlanTier::Team),
                        _ => None,
                    })
                    .unwrap_or(PlanTier::Pro);

                db::subscriptions::update_from_stripe(
                    &state.db,
                    ws_id,
                    &plan,
                    customer_id,
                    subscription_id,
                    None,
                )
                .await?;

                tracing::info!(workspace_id = %ws_id, plan = ?plan, "subscription activated");
            }
        }
        "customer.subscription.deleted" => {
            let sub = &event["data"]["object"];
            if let Some(sub_id) = sub["id"].as_str() {
                db::subscriptions::cancel(&state.db, sub_id).await?;
                tracing::info!(subscription_id = sub_id, "subscription canceled");
            }
        }
        _ => {
            tracing::debug!(event_type, "unhandled stripe event");
        }
    }

    Ok(StatusCode::OK)
}

