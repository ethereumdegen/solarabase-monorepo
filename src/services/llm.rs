use rig::client::CompletionClient;
use rig::completion::{Chat, Message as RigMessage};
use rig::providers::openai;

type BoxErr = Box<dyn std::error::Error + Send + Sync>;

pub struct LlmClient {
    client: openai::Client,
    model_name: String,
}

impl LlmClient {
    pub fn new_with_model(api_key: &str, model: &str) -> Self {
        let client =
            openai::Client::new(api_key).expect("failed to create OpenAI client");
        Self {
            client,
            model_name: model.to_string(),
        }
    }

    pub async fn complete(&self, system: &str, user: &str) -> Result<String, BoxErr> {
        let agent = self
            .client
            .agent(&self.model_name)
            .preamble(system)
            .build();
        let history: Vec<RigMessage> = vec![];
        let response = agent.chat(user, history).await?;
        Ok(response)
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
