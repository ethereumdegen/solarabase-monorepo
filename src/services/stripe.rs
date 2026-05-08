use hmac::{Hmac, Mac};
use sha2::Sha256;

use crate::config::StripeConfig;
use crate::error::{AppError, AppResult};

type HmacSha256 = Hmac<Sha256>;

pub fn verify_webhook_signature(
    payload: &[u8],
    sig_header: &str,
    secret: &str,
) -> AppResult<()> {
    // Parse Stripe-Signature header: t=timestamp,v1=signature
    let mut timestamp = "";
    let mut signature = "";

    for part in sig_header.split(',') {
        if let Some(t) = part.strip_prefix("t=") {
            timestamp = t;
        }
        if let Some(v) = part.strip_prefix("v1=") {
            signature = v;
        }
    }

    if timestamp.is_empty() || signature.is_empty() {
        return Err(AppError::BadRequest("invalid stripe signature header".into()));
    }

    let signed_payload = format!("{timestamp}.{}", String::from_utf8_lossy(payload));
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|e| AppError::Internal(e.to_string()))?;
    mac.update(signed_payload.as_bytes());

    let expected = hex::encode(mac.finalize().into_bytes());

    if expected != signature {
        return Err(AppError::BadRequest("invalid stripe signature".into()));
    }

    // Reject events older than 5 minutes (replay protection)
    if let Ok(ts) = timestamp.parse::<i64>() {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        if (now - ts).abs() > 300 {
            return Err(AppError::BadRequest("stripe webhook timestamp too old".into()));
        }
    }

    Ok(())
}

pub async fn create_checkout_session(
    config: &StripeConfig,
    price_id: &str,
    customer_email: &str,
    user_id: &str,
    kb_id: &str,
    plan: &str,
) -> AppResult<String> {
    let client = reqwest::Client::new();
    let public_url = std::env::var("PUBLIC_URL").unwrap_or_else(|_| "http://localhost:3000".into());
    let resp = client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .basic_auth(&config.secret_key, None::<&str>)
        .form(&[
            ("mode", "subscription"),
            ("payment_method_types[]", "card"),
            ("line_items[0][price]", price_id),
            ("line_items[0][quantity]", "1"),
            ("customer_email", customer_email),
            ("success_url", &format!("{public_url}/kb/{kb_id}?billing=success")),
            ("cancel_url", &format!("{public_url}/kb/{kb_id}?billing=cancel")),
            ("metadata[kb_id]", kb_id),
            ("metadata[user_id]", user_id),
            ("metadata[plan]", plan),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    body["url"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Internal("no checkout url in stripe response".into()))
}

pub async fn create_portal_session(
    config: &StripeConfig,
    customer_id: &str,
) -> AppResult<String> {
    let client = reqwest::Client::new();
    let public_url = std::env::var("PUBLIC_URL").unwrap_or_else(|_| "http://localhost:3000".into());
    let resp = client
        .post("https://api.stripe.com/v1/billing_portal/sessions")
        .basic_auth(&config.secret_key, None::<&str>)
        .form(&[
            ("customer", customer_id),
            ("return_url", &format!("{public_url}/dashboard")),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    body["url"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Internal("no portal url in stripe response".into()))
}
