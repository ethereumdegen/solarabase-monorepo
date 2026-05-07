use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub database_url: String,
    pub s3_region: String,
    pub s3_access_key: String,
    pub s3_secret_key: String,
    pub s3_bucket: String,
    pub s3_endpoint: Option<String>,
    pub openai_api_key: String,
    pub openai_model: String,
    pub host: String,
    pub port: u16,
    pub public_url: String,

    // Google OAuth
    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_redirect_uri: String,

    // JWT
    pub jwt_secret: String,

    // Stripe
    pub stripe_secret_key: String,
    pub stripe_webhook_secret: String,
    pub stripe_pro_price_id: String,
    pub stripe_team_price_id: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL required"),
            s3_region: env::var("S3_REGION").unwrap_or_else(|_| "nyc3".into()),
            s3_access_key: env::var("S3_ACCESS_KEY").expect("S3_ACCESS_KEY required"),
            s3_secret_key: env::var("S3_SECRET_KEY").expect("S3_SECRET_KEY required"),
            s3_bucket: env::var("S3_BUCKET").unwrap_or_else(|_| "solarabase-docs".into()),
            s3_endpoint: env::var("S3_ENDPOINT").ok().filter(|s| !s.is_empty()),
            openai_api_key: env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY required"),
            openai_model: env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o".into()),
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3000".into())
                .parse()
                .expect("PORT must be a number"),
            public_url: env::var("PUBLIC_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            google_client_id: env::var("GOOGLE_CLIENT_ID")
                .expect("GOOGLE_CLIENT_ID required"),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET")
                .expect("GOOGLE_CLIENT_SECRET required"),
            google_redirect_uri: env::var("GOOGLE_REDIRECT_URI")
                .expect("GOOGLE_REDIRECT_URI required"),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET required"),
            stripe_secret_key: env::var("STRIPE_SECRET_KEY")
                .unwrap_or_else(|_| String::new()),
            stripe_webhook_secret: env::var("STRIPE_WEBHOOK_SECRET")
                .unwrap_or_else(|_| String::new()),
            stripe_pro_price_id: env::var("STRIPE_PRO_PRICE_ID")
                .unwrap_or_else(|_| String::new()),
            stripe_team_price_id: env::var("STRIPE_TEAM_PRICE_ID")
                .unwrap_or_else(|_| String::new()),
        }
    }
}
