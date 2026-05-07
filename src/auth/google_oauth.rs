use serde::Deserialize;

use crate::config::AppConfig;

#[derive(Debug, Deserialize)]
pub struct GoogleTokenResponse {
    pub access_token: String,
}

#[derive(Debug, Deserialize)]
pub struct GoogleUserInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
}

pub fn google_auth_url(config: &AppConfig, state: &str) -> String {
    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent&state={}",
        config.google_client_id,
        urlencoding(&config.google_redirect_uri),
        state,
    )
}

pub fn generate_oauth_state() -> String {
    hex::encode(rand::random::<[u8; 16]>())
}

fn urlencoding(s: &str) -> String {
    s.replace(':', "%3A").replace('/', "%2F")
}

pub async fn exchange_code(
    config: &AppConfig,
    code: &str,
) -> Result<GoogleTokenResponse, Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code),
            ("client_id", &config.google_client_id),
            ("client_secret", &config.google_client_secret),
            ("redirect_uri", &config.google_redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await?;
        return Err(format!("Google token exchange failed: {text}").into());
    }

    Ok(resp.json().await?)
}

pub async fn fetch_user_info(
    access_token: &str,
) -> Result<GoogleUserInfo, Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(access_token)
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await?;
        return Err(format!("Google userinfo failed: {text}").into());
    }

    Ok(resp.json().await?)
}
