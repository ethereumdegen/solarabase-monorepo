use std::env;

#[derive(Clone, Debug)]
pub struct S3Config {
    pub region: String,
    pub access_key: String,
    pub secret_key: String,
    pub bucket: String,
    pub endpoint: Option<String>,
}

#[derive(Clone, Debug)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Clone, Debug)]
pub struct StripeConfig {
    pub secret_key: String,
    pub webhook_secret: String,
    pub pro_price_id: String,
    pub team_price_id: String,
}

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub database_url: String,
    pub s3: Option<S3Config>,
    pub openai_api_key: String,
    pub openai_model: String,
    pub host: String,
    pub port: u16,
    pub public_url: String,
    pub google_oauth: Option<GoogleOAuthConfig>,
    pub jwt_secret: String,
    pub stripe: Option<StripeConfig>,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let s3 = match (env::var("S3_ACCESS_KEY"), env::var("S3_SECRET_KEY")) {
            (Ok(access_key), Ok(secret_key)) if !access_key.is_empty() && !secret_key.is_empty() => {
                Some(S3Config {
                    region: env::var("S3_REGION").unwrap_or_else(|_| "nyc3".into()),
                    access_key,
                    secret_key,
                    bucket: env::var("S3_BUCKET").unwrap_or_else(|_| "solarabase-docs".into()),
                    endpoint: env::var("S3_ENDPOINT").ok().filter(|s| !s.is_empty()),
                })
            }
            _ => {
                tracing::warn!("S3 not configured — document upload/indexing disabled");
                None
            }
        };

        let google_oauth = match (env::var("GOOGLE_CLIENT_ID"), env::var("GOOGLE_CLIENT_SECRET")) {
            (Ok(client_id), Ok(client_secret)) if !client_id.is_empty() && !client_secret.is_empty() => {
                Some(GoogleOAuthConfig {
                    client_id,
                    client_secret,
                    redirect_uri: env::var("GOOGLE_REDIRECT_URI")
                        .unwrap_or_else(|_| "http://localhost:3000/auth/google/callback".into()),
                })
            }
            _ => {
                tracing::warn!("Google OAuth not configured — using dev login mode");
                None
            }
        };

        let stripe = match env::var("STRIPE_SECRET_KEY") {
            Ok(secret_key) if !secret_key.is_empty() => {
                Some(StripeConfig {
                    secret_key,
                    webhook_secret: env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default(),
                    pro_price_id: env::var("STRIPE_PRO_PRICE_ID").unwrap_or_default(),
                    team_price_id: env::var("STRIPE_TEAM_PRICE_ID").unwrap_or_default(),
                })
            }
            _ => {
                tracing::warn!("Stripe not configured — billing disabled (all workspaces get free plan)");
                None
            }
        };

        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL required"),
            s3,
            openai_api_key: env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY required"),
            openai_model: env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o".into()),
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3000".into())
                .parse()
                .expect("PORT must be a number"),
            public_url: env::var("PUBLIC_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            google_oauth,
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET required"),
            stripe,
        }
    }
}
