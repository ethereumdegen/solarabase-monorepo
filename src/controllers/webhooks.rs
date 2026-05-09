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
    let stripe = state.config.stripe.as_ref()
        .ok_or_else(|| AppError::BadRequest("Stripe not configured".into()))?;

    let sig = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    stripe_svc::verify_webhook_signature(&body, sig, &stripe.webhook_secret)?;

    let event: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let event_type = event["type"].as_str().unwrap_or("");
    let event_id = event["id"].as_str().unwrap_or("unknown");

    // Log all webhook events to audit log for diagnostics
    let _ = db::audit_logs::insert(
        &state.db,
        None,
        &format!("stripe_webhook:{event_type}"),
        "stripe",
        None,
        Some(&serde_json::json!({
            "event_id": event_id,
            "type": event_type,
        })),
        None,
    ).await;

    match event_type {
        "checkout.session.completed" => {
            let session = &event["data"]["object"];
            let kb_id = session["metadata"]["kb_id"]
                .as_str()
                .and_then(|s| uuid::Uuid::parse_str(s).ok());

            if let Some(kid) = kb_id {
                let customer_id = session["customer"].as_str().unwrap_or("");
                let subscription_id = session["subscription"].as_str().unwrap_or("");

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
                    kid,
                    &plan,
                    customer_id,
                    subscription_id,
                    None, // period_end will be set by subscription.updated event
                )
                .await?;

                tracing::info!(kb_id = %kid, plan = ?plan, "subscription activated via checkout");
            }
        }
        "customer.subscription.updated" => {
            let sub = &event["data"]["object"];
            if let Some(sub_id) = sub["id"].as_str() {
                // Extract plan from price metadata or items
                let plan_str = sub["items"]["data"][0]["price"]["lookup_key"]
                    .as_str()
                    .or_else(|| sub["metadata"]["plan"].as_str());

                let plan = plan_str.and_then(|p| match p {
                    "pro" => Some(PlanTier::Pro),
                    "team" => Some(PlanTier::Team),
                    _ => None,
                });

                // Extract period end
                let period_end = sub["current_period_end"]
                    .as_i64()
                    .and_then(|ts| {
                        chrono::DateTime::from_timestamp(ts, 0)
                    });

                // Extract status
                let status = sub["status"].as_str().unwrap_or("active");

                db::subscriptions::sync_from_stripe(
                    &state.db,
                    sub_id,
                    plan.clone(),
                    status,
                    period_end,
                ).await?;

                tracing::info!(subscription_id = sub_id, ?plan, status, "subscription updated");
            }
        }
        "customer.subscription.deleted" => {
            let sub = &event["data"]["object"];
            if let Some(sub_id) = sub["id"].as_str() {
                db::subscriptions::cancel(&state.db, sub_id).await?;
                tracing::info!(subscription_id = sub_id, "subscription canceled/deleted");
            }
        }
        "invoice.payment_failed" => {
            let invoice = &event["data"]["object"];
            if let Some(sub_id) = invoice["subscription"].as_str() {
                db::subscriptions::set_status(&state.db, sub_id, "past_due").await?;
                tracing::warn!(subscription_id = sub_id, "payment failed — marked past_due");
            }
        }
        _ => {
            tracing::debug!(event_type, "unhandled stripe event");
        }
    }

    Ok(StatusCode::OK)
}
