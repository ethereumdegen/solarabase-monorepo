use std::time::Instant;

use rig::client::CompletionClient;
use rig::completion::{Chat, Message as RigMessage};
use rig::providers::openai;
use sqlx::PgPool;
use uuid::Uuid;

use crate::db;

type BoxErr = Box<dyn std::error::Error + Send + Sync>;

#[derive(Clone, Default)]
pub struct LlmContext {
    pub kb_id: Option<Uuid>,
    pub session_id: Option<Uuid>,
    pub request_type: String,
}

pub struct LlmClient {
    client: openai::Client,
    model_name: String,
    db: Option<PgPool>,
    ctx: LlmContext,
}

impl LlmClient {
    pub fn new_with_model(api_key: &str, model: &str) -> Self {
        let client =
            openai::Client::new(api_key).expect("failed to create OpenAI client");
        Self {
            client,
            model_name: model.to_string(),
            db: None,
            ctx: LlmContext::default(),
        }
    }

    pub fn with_logging(mut self, db: PgPool, ctx: LlmContext) -> Self {
        self.db = Some(db);
        self.ctx = ctx;
        self
    }

    pub async fn complete(&self, system: &str, user: &str) -> Result<String, BoxErr> {
        let start = Instant::now();
        let agent = self
            .client
            .agent(&self.model_name)
            .preamble(system)
            .build();
        let history: Vec<RigMessage> = vec![];
        let result = agent.chat(user, history).await;
        let latency_ms = start.elapsed().as_millis() as i32;

        let input_chars = (system.len() + user.len()) as i32;

        match &result {
            Ok(response) => {
                self.log_call(input_chars, response.len() as i32, latency_ms, "success", None);
                Ok(response.clone())
            }
            Err(e) => {
                self.log_call(input_chars, 0, latency_ms, "error", Some(&e.to_string()));
                Err(e.to_string().into())
            }
        }
    }

    pub async fn complete_json(
        &self,
        system: &str,
        user: &str,
    ) -> Result<serde_json::Value, BoxErr> {
        let raw = self.complete(system, user).await?;

        let json_str = extract_json(&raw);
        match serde_json::from_str::<serde_json::Value>(json_str) {
            Ok(v) => Ok(v),
            Err(e) => {
                tracing::warn!("JSON parse failed, retrying: {e}");
                let retry_prompt = format!(
                    "Your previous response was not valid JSON. Please output ONLY valid JSON with no markdown fences.\n\nOriginal request:\n{user}"
                );
                let raw2 = self.complete(system, &retry_prompt).await?;
                let json_str2 = extract_json(&raw2);
                Ok(serde_json::from_str(json_str2)?)
            }
        }
    }

    fn log_call(&self, input_chars: i32, output_chars: i32, latency_ms: i32, status: &str, error_msg: Option<&str>) {
        let Some(db) = &self.db else { return };
        let db = db.clone();
        let kb_id = self.ctx.kb_id;
        let session_id = self.ctx.session_id;
        let request_type = if self.ctx.request_type.is_empty() {
            "complete".to_string()
        } else {
            self.ctx.request_type.clone()
        };
        let model = self.model_name.clone();
        let status = status.to_string();
        let error_msg = error_msg.map(|s| s.to_string());

        // Fire-and-forget
        tokio::spawn(async move {
            if let Err(e) = db::llm_logs::insert(
                &db,
                kb_id,
                session_id,
                &request_type,
                &model,
                input_chars,
                output_chars,
                latency_ms,
                &status,
                error_msg.as_deref(),
            )
            .await
            {
                tracing::warn!("failed to log LLM call: {e}");
            }
        });
    }
}

fn extract_json(s: &str) -> &str {
    let trimmed = s.trim();
    if let Some(start) = trimmed.find("```json") {
        let after = &trimmed[start + 7..];
        if let Some(end) = after.find("```") {
            return after[..end].trim();
        }
    }
    if let Some(start) = trimmed.find("```") {
        let after = &trimmed[start + 3..];
        if let Some(end) = after.find("```") {
            return after[..end].trim();
        }
    }
    trimmed
}
