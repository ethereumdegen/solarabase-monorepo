use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;

use crate::auth::extractors::AuthUser;
use crate::auth::google_oauth;
use crate::auth::jwt::sign_jwt;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// GET /auth/google — redirect to Google consent screen with CSRF state
pub async fn google_redirect(State(state): State<AppState>) -> Result<Response, AppError> {
    let oauth = state.config.google_oauth.as_ref()
        .ok_or_else(|| AppError::BadRequest("Google OAuth not configured".into()))?;

    let csrf_state = google_oauth::generate_oauth_state();
    let url = google_oauth::google_auth_url(oauth, &csrf_state);

    let is_https = state.config.public_url.starts_with("https://");
    let secure_flag = if is_https { "; Secure" } else { "" };
    let state_cookie = format!(
        "sb_oauth_state={csrf_state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax{secure_flag}"
    );

    let mut headers = HeaderMap::new();
    headers.insert("set-cookie", state_cookie.parse().unwrap());
    headers.insert("location", url.parse().unwrap());

    Ok((StatusCode::FOUND, headers).into_response())
}

#[derive(Deserialize)]
pub struct GoogleCallback {
    pub code: String,
    pub state: Option<String>,
}

/// GET /auth/google/callback — validate state, exchange code, upsert user, set cookie, redirect
pub async fn google_callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<GoogleCallback>,
) -> Result<Response, AppError> {
    let oauth = state.config.google_oauth.as_ref()
        .ok_or_else(|| AppError::BadRequest("Google OAuth not configured".into()))?;

    // Validate CSRF state
    let expected_state = extract_cookie(&headers, "sb_oauth_state");
    let received_state = params.state.as_deref().unwrap_or("");
    if expected_state.is_empty() || expected_state != received_state {
        tracing::error!(expected = %expected_state, received = %received_state, "oauth state mismatch");
        return Err(AppError::BadRequest("invalid oauth state — cookies may be blocked".into()));
    }

    let token_resp = google_oauth::exchange_code(oauth, &params.code)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "google token exchange failed");
            AppError::Internal(e.to_string())
        })?;

    let user_info = google_oauth::fetch_user_info(&token_resp.access_token)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "google userinfo fetch failed");
            AppError::Internal(e.to_string())
        })?;

    let user = db::users::upsert_from_google(
        &state.db,
        &user_info.id,
        &user_info.email,
        &user_info.name,
        user_info.picture.as_deref(),
    )
    .await?;

    tracing::info!(user_id = %user.id, email = %user.email, "user logged in");

    // Ensure user has a subscription
    db::subscriptions::get_or_create_free(&state.db, user.id).await?;

    let jwt = sign_jwt(user.id, &user.email, &state.config.jwt_secret)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let is_https = state.config.public_url.starts_with("https://");
    let secure_flag = if is_https { "; Secure" } else { "" };

    let session_cookie = format!(
        "sb_session={jwt}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax{secure_flag}"
    );
    let clear_state_cookie = "sb_oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax";

    let mut resp_headers = HeaderMap::new();
    resp_headers.append("set-cookie", session_cookie.parse().unwrap());
    resp_headers.append("set-cookie", clear_state_cookie.parse().unwrap());
    resp_headers.insert("location", "/dashboard".parse().unwrap());

    Ok((StatusCode::FOUND, resp_headers).into_response())
}

#[derive(Deserialize)]
pub struct DevLoginRequest {
    pub email: String,
    pub name: Option<String>,
}

/// POST /auth/dev-login — development-only login (only works when Google OAuth is NOT configured)
pub async fn dev_login(
    State(state): State<AppState>,
    Json(req): Json<DevLoginRequest>,
) -> Result<Response, AppError> {
    if state.config.google_oauth.is_some() {
        return Err(AppError::BadRequest("dev login disabled when Google OAuth is configured".into()));
    }

    let name = req.name.unwrap_or_else(|| req.email.split('@').next().unwrap_or("user").to_string());
    let google_id = format!("dev_{}", sha2_hex(&req.email));

    let user = db::users::upsert_from_google(
        &state.db,
        &google_id,
        &req.email,
        &name,
        None,
    )
    .await?;

    // Ensure user has a subscription
    db::subscriptions::get_or_create_free(&state.db, user.id).await?;

    let jwt = sign_jwt(user.id, &user.email, &state.config.jwt_secret)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let session_cookie = format!(
        "sb_session={jwt}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax"
    );

    let mut headers = HeaderMap::new();
    headers.insert("set-cookie", session_cookie.parse().unwrap());

    tracing::info!(user_id = %user.id, email = %user.email, "dev login");

    Ok((StatusCode::OK, headers, Json(serde_json::json!(user))).into_response())
}

fn sha2_hex(s: &str) -> String {
    use sha2::{Sha256, Digest};
    hex::encode(Sha256::digest(s.as_bytes()))
}

/// POST /auth/logout — clear cookie
pub async fn logout(State(state): State<AppState>) -> impl IntoResponse {
    let is_https = state.config.public_url.starts_with("https://");
    let secure_flag = if is_https { "; Secure" } else { "" };
    let cookie = format!("sb_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax{secure_flag}");
    let mut headers = HeaderMap::new();
    headers.insert("set-cookie", cookie.parse().unwrap());
    (StatusCode::OK, headers, Json(serde_json::json!({"ok": true})))
}

/// GET /api/auth/me — current user
pub async fn me(AuthUser(user): AuthUser) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!(user)))
}

/// GET /api/auth/providers — which auth methods are available (public)
pub async fn providers(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "google": state.config.google_oauth.is_some(),
        "dev_login": state.config.google_oauth.is_none(),
    }))
}

fn extract_cookie(headers: &HeaderMap, name: &str) -> String {
    headers
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(';')
        .find_map(|c| {
            let c = c.trim();
            c.strip_prefix(&format!("{name}=")).map(|v| v.to_string())
        })
        .unwrap_or_default()
}
