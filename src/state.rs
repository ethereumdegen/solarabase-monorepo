use std::sync::Arc;

use s3::Bucket;
use sqlx::PgPool;

use crate::config::AppConfig;
use crate::services::rag_cache::RagCache;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub bucket: Option<Arc<Box<Bucket>>>,
    pub config: Arc<AppConfig>,
    pub rag_cache: Arc<RagCache>,
}

impl AppState {
    pub fn require_bucket(&self) -> Result<&Arc<Box<Bucket>>, crate::error::AppError> {
        self.bucket.as_ref().ok_or_else(|| {
            crate::error::AppError::BadRequest("S3 storage not configured".into())
        })
    }
}
