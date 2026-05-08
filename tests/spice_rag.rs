use async_trait::async_trait;
use reqwest::{multipart, Client};
use serde_json::json;
use spice_framework::agent::{AgentConfig, AgentOutput, AgentUnderTest, Turn};
use spice_framework::error::SpiceError;
use spice_framework::*;
use std::sync::Arc;
use std::time::{Duration, Instant};

const BASE_URL: &str = "http://localhost:3000";

/// Wraps the Solarabase HTTP API as a Spice AgentUnderTest.
struct SolarabaseAgent {
    client: Client,
    kb_id: String,
}

impl SolarabaseAgent {
    async fn setup() -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::builder().cookie_store(true).build()?;

        // Dev login — cookie jar auto-stores the session cookie
        let resp = client
            .post(format!("{BASE_URL}/auth/dev-login"))
            .json(&json!({"email": "spice-test@test.com"}))
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(format!("Login failed: {}", resp.status()).into());
        }

        // Get workspace
        let workspaces: Vec<serde_json::Value> = client
            .get(format!("{BASE_URL}/api/workspaces"))
            .send()
            .await?
            .json()
            .await?;
        let ws_id = workspaces[0]["id"]
            .as_str()
            .ok_or("No workspace found")?
            .to_string();

        // List existing KBs — reuse a spice test KB if one exists, else create
        let kbs: Vec<serde_json::Value> = client
            .get(format!("{BASE_URL}/api/workspaces/{ws_id}/kbs"))
            .send()
            .await?
            .json()
            .await?;

        let kb_id = if let Some(existing) = kbs
            .iter()
            .find(|kb| kb["name"].as_str() == Some("Spice Test KB"))
        {
            existing["id"].as_str().unwrap().to_string()
        } else {
            let slug = format!("spice-{}", uuid::Uuid::new_v4().simple());
            let resp = client
                .post(format!("{BASE_URL}/api/workspaces/{ws_id}/kbs"))
                .json(&json!({
                    "name": "Spice Test KB",
                    "slug": slug,
                    "description": "Auto-created by spice test"
                }))
                .send()
                .await?;
            let kb: serde_json::Value = resp.json().await?;
            kb["id"]
                .as_str()
                .ok_or_else(|| format!("KB creation failed: {kb}"))?
                .to_string()
        };
        eprintln!("  using KB: {kb_id}");

        // Check if TELLER doc already exists and is indexed
        let docs: Vec<serde_json::Value> = client
            .get(format!("{BASE_URL}/api/kb/{kb_id}/documents"))
            .send()
            .await?
            .json()
            .await?;
        let teller_indexed = docs.iter().any(|d| {
            d["filename"].as_str() == Some("TELLER_ERROR_CODES.md")
                && d["status"].as_str() == Some("indexed")
        });

        if teller_indexed {
            eprintln!("  TELLER_ERROR_CODES.md already indexed, skipping upload");
            return Ok(Self { client, kb_id });
        }

        // Upload the test document
        let doc_bytes =
            std::fs::read("/home/andy/rust4ai/knowledgebase-agent/docs/TELLER_ERROR_CODES.md")?;
        let part = multipart::Part::bytes(doc_bytes)
            .file_name("TELLER_ERROR_CODES.md")
            .mime_str("text/markdown")?;
        let form = multipart::Form::new().part("file", part);

        client
            .post(format!("{BASE_URL}/api/kb/{kb_id}/documents"))
            .multipart(form)
            .send()
            .await?;

        // Poll until indexed (max 300s — indexing + wiki generation takes ~4 min)
        let deadline = Instant::now() + Duration::from_secs(300);
        loop {
            tokio::time::sleep(Duration::from_secs(3)).await;
            let docs: Vec<serde_json::Value> = client
                .get(format!("{BASE_URL}/api/kb/{kb_id}/documents"))
                .send()
                .await?
                .json()
                .await?;

            // Find the TELLER doc specifically
            let teller_doc = docs
                .iter()
                .find(|d| d["filename"].as_str() == Some("TELLER_ERROR_CODES.md"));
            let status = teller_doc
                .and_then(|d| d["status"].as_str())
                .unwrap_or("unknown");

            eprintln!("  indexing status: {status}");
            match status {
                "indexed" => break,
                "failed" => {
                    let msg = teller_doc
                        .and_then(|d| d["error_msg"].as_str())
                        .unwrap_or("unknown");
                    return Err(format!("Document indexing failed: {msg}").into());
                }
                _ if Instant::now() > deadline => {
                    return Err("Timed out waiting for document indexing".into());
                }
                _ => continue,
            }
        }

        Ok(Self { client, kb_id })
    }
}

#[async_trait]
impl AgentUnderTest for SolarabaseAgent {
    async fn run(
        &self,
        user_message: &str,
        _config: &AgentConfig,
    ) -> Result<AgentOutput, SpiceError> {
        let start = Instant::now();

        let resp = self
            .client
            .post(format!("{BASE_URL}/api/kb/{}/query", self.kb_id))
            .json(&json!({"question": user_message}))
            .send()
            .await
            .map_err(|e| SpiceError::AgentError(e.to_string()))?;

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SpiceError::AgentError(e.to_string()))?;

        let answer = body["answer"].as_str().unwrap_or("").to_string();
        let tools_used: Vec<String> = body["tools_used"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        eprintln!(
            "  agent answer: {}",
            &answer[..answer.len().min(200)]
        );

        Ok(AgentOutput {
            final_text: answer,
            turns: vec![Turn {
                index: 0,
                output_text: Some(body["answer"].as_str().unwrap_or("").to_string()),
                tool_calls: vec![],
                tool_results: vec![],
                stop_reason: Some("stop".into()),
                duration: start.elapsed(),
            }],
            tools_called: tools_used,
            duration: start.elapsed(),
            error: None,
        })
    }

    fn available_tools(&self, _config: &AgentConfig) -> Vec<String> {
        vec!["retrieve_pages".into()]
    }

    fn name(&self) -> &str {
        "solarabase-rag"
    }
}

#[tokio::test]
async fn spice_rag_query_test() {
    let _ = dotenvy::dotenv();

    eprintln!("Setting up test agent (uploading doc + waiting for indexing)...");
    let agent = SolarabaseAgent::setup()
        .await
        .expect("Failed to set up test agent");
    eprintln!("Setup complete, running spice suite...");

    let suite = spice_framework::suite(
        "Solarabase RAG Tests",
        vec![test("prl-meaning", "What does PRL mean?")
            .name("PRL error code lookup")
            .tag("rag")
            .expect_text_contains("Pool Route Length")
            .expect_no_error()
            .retries(2)
            .build()],
    );

    let runner = Runner::new(RunnerConfig {
        concurrency: 1,
        report_path: Some("spice-report.json".into()),
        trace_dir: Some("spice-traces".into()),
        ..Default::default()
    });

    let report = runner.run(suite, Arc::new(agent)).await;

    assert_eq!(
        report.failed, 0,
        "Spice test(s) failed — see spice-report.json"
    );
}
