use std::time::Duration;

use serde_json::json;
use tokio::time::sleep;

use crate::db;
use crate::models::document::DocStatus;
use crate::services::{llm::LlmClient, s3};
use crate::state::AppState;

type BoxErr = Box<dyn std::error::Error + Send + Sync>;

/// Background worker that polls for uploaded documents globally and indexes them.
pub async fn run_indexer_loop(state: AppState) {
    tracing::info!("indexer worker started");

    loop {
        match process_pending(&state).await {
            Ok(count) => {
                if count > 0 {
                    tracing::info!(count, "indexed documents");
                }
            }
            Err(e) => {
                tracing::error!("indexer error: {e}");
            }
        }
        sleep(Duration::from_secs(5)).await;
    }
}

async fn process_pending(state: &AppState) -> Result<usize, BoxErr> {
    let pending = db::documents::find_pending_global(&state.db).await?;
    let count = pending.len();

    for doc in pending {
        tracing::info!(doc_id = %doc.id, kb_id = %doc.kb_id, filename = %doc.filename, "processing document");

        db::documents::update_status(&state.db, doc.id, DocStatus::Processing, None).await?;

        // Look up KB model for this document
        let kb = db::knowledgebases::get_by_id(&state.db, doc.kb_id).await?;
        let model = kb.as_ref().map(|k| k.model.as_str()).unwrap_or("gpt-4o");
        let llm = LlmClient::new_with_model(&state.config.openai_api_key, model);

        match index_document(state, &llm, &doc).await {
            Ok(()) => {
                db::documents::update_status(&state.db, doc.id, DocStatus::Indexed, None).await?;
                tracing::info!(doc_id = %doc.id, "document indexed successfully");
            }
            Err(e) => {
                let msg = e.to_string();
                tracing::error!(doc_id = %doc.id, error = %msg, "indexing failed");
                db::documents::update_status(&state.db, doc.id, DocStatus::Failed, Some(&msg))
                    .await?;
            }
        }
    }

    Ok(count)
}

async fn index_document(
    state: &AppState,
    llm: &LlmClient,
    doc: &crate::models::document::Document,
) -> Result<(), BoxErr> {
    let bucket = state.require_bucket().map_err(|e| -> BoxErr { e.to_string().into() })?;
    let bytes = s3::download_bytes(bucket, &doc.s3_key).await?;
    let text = String::from_utf8_lossy(&bytes).to_string();

    let pages = split_into_pages(&text);
    let page_count = pages.len() as i32;

    db::documents::update_page_count(&state.db, doc.id, page_count).await?;

    let mut page_summaries = Vec::new();

    for (i, page_content) in pages.iter().enumerate() {
        let page_num = (i + 1) as i32;

        tracing::info!(doc_id = %doc.id, page = page_num, total = page_count, "indexing page");

        let tree_index = build_page_tree_index(llm, page_content, page_num, &doc.filename).await?;

        db::page_indexes::insert_page(&state.db, doc.id, page_num, page_content, &tree_index)
            .await?;

        page_summaries.push(json!({
            "page": page_num,
            "summary": tree_index.get("summary").cloned().unwrap_or(json!("")),
            "topics": tree_index.get("topics").cloned().unwrap_or(json!([]))
        }));
    }

    let root_index = build_document_root_index(llm, &doc.filename, &page_summaries).await?;

    db::page_indexes::insert_document_index(&state.db, doc.id, &root_index).await?;

    Ok(())
}

const PAGE_INDEX_SYSTEM: &str = r#"You are a document indexing system that creates structured tree indexes for document pages.

Given a page of text, produce a JSON tree index with this exact structure:
{
  "page": <page_number>,
  "summary": "<2-3 sentence summary of what this page covers>",
  "key_entities": ["<important named entities, concepts, terms>"],
  "topics": [
    {
      "name": "<topic heading>",
      "summary": "<1 sentence describing this topic>",
      "key_points": ["<important facts or claims under this topic>"],
      "subtopics": [
        {
          "name": "<subtopic>",
          "summary": "<brief description>"
        }
      ]
    }
  ],
  "relationships": ["<references to other concepts that might appear on other pages>"]
}

Rules:
- Output ONLY valid JSON, no markdown fences, no explanation
- Identify 1-5 main topics per page
- Each topic may have 0-3 subtopics
- key_entities should capture proper nouns, technical terms, important numbers
- relationships should note cross-references or dependency on other content
- If the page is mostly empty or structural (table of contents, etc.), note that in summary"#;

async fn build_page_tree_index(
    llm: &LlmClient,
    content: &str,
    page_num: i32,
    filename: &str,
) -> Result<serde_json::Value, BoxErr> {
    let user_prompt = format!(
        "Document: {filename}\nPage: {page_num}\n\n---\n{content}\n---\n\nCreate the tree index for this page.",
    );

    match llm.complete_json(PAGE_INDEX_SYSTEM, &user_prompt).await {
        Ok(index) => Ok(index),
        Err(e) => {
            tracing::warn!(page = page_num, error = %e, "LLM indexing failed, using fallback");
            Ok(build_fallback_tree_index(content, page_num))
        }
    }
}

const ROOT_INDEX_SYSTEM: &str = r#"You are a document indexing system that creates a root-level tree index summarizing an entire document.

Given page summaries, produce a JSON root index with this exact structure:
{
  "summary": "<3-5 sentence overview of the entire document>",
  "key_themes": ["<major themes across the document>"],
  "page_map": [
    {
      "pages": [1, 2],
      "theme": "<what these pages cover together>",
      "relevance_keywords": ["<keywords that would match queries about this section>"]
    }
  ],
  "entity_index": {
    "<entity_name>": [1, 3, 5]
  }
}

Rules:
- Output ONLY valid JSON, no markdown fences
- page_map groups related pages by theme (a page can appear in multiple groups)
- entity_index maps important entities to the page numbers where they appear
- relevance_keywords should include synonyms and related terms for better retrieval
- key_themes should capture 3-7 high-level themes"#;

async fn build_document_root_index(
    llm: &LlmClient,
    filename: &str,
    page_summaries: &[serde_json::Value],
) -> Result<serde_json::Value, BoxErr> {
    let summaries_text = serde_json::to_string_pretty(page_summaries)?;
    let user_prompt = format!(
        "Document: {filename}\n\nPage summaries:\n{summaries_text}\n\nCreate the root index for this document."
    );

    match llm.complete_json(ROOT_INDEX_SYSTEM, &user_prompt).await {
        Ok(mut index) => {
            if let Some(obj) = index.as_object_mut() {
                obj.insert("filename".into(), json!(filename));
                obj.insert("page_count".into(), json!(page_summaries.len()));
            }
            Ok(index)
        }
        Err(e) => {
            tracing::warn!(error = %e, "LLM root index failed, using fallback");
            Ok(json!({
                "filename": filename,
                "page_count": page_summaries.len(),
                "summary": "Index generation failed - fallback mode",
                "pages": page_summaries,
            }))
        }
    }
}

pub fn split_into_pages(text: &str) -> Vec<String> {
    let ff_pages: Vec<&str> = text.split('\x0C').collect();
    if ff_pages.len() > 1 {
        return ff_pages
            .into_iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
    }

    let paragraphs: Vec<&str> = text.split("\n\n").collect();
    let mut pages = Vec::new();
    let mut current_page = String::new();

    for para in paragraphs {
        if current_page.len() + para.len() > 3000 && !current_page.is_empty() {
            pages.push(current_page.trim().to_string());
            current_page = String::new();
        }
        if !current_page.is_empty() {
            current_page.push_str("\n\n");
        }
        current_page.push_str(para);
    }

    if !current_page.trim().is_empty() {
        pages.push(current_page.trim().to_string());
    }

    if pages.is_empty() {
        pages.push(text.to_string());
    }

    pages
}

fn build_fallback_tree_index(content: &str, page_num: i32) -> serde_json::Value {
    let lines: Vec<&str> = content.lines().collect();

    let topics: Vec<serde_json::Value> = lines
        .iter()
        .filter(|line| {
            let trimmed = line.trim();
            trimmed.starts_with('#')
                || (trimmed.len() > 3
                    && trimmed.len() < 80
                    && trimmed
                        .chars()
                        .all(|c| c.is_uppercase() || c.is_whitespace() || c.is_ascii_punctuation()))
        })
        .map(|line| {
            json!({
                "name": line.trim().trim_start_matches('#').trim(),
                "summary": "",
                "key_points": [],
                "subtopics": []
            })
        })
        .collect();

    let truncated = if content.len() <= 300 {
        content.to_string()
    } else {
        format!("{}...", &content[..300])
    };

    json!({
        "page": page_num,
        "summary": truncated,
        "key_entities": [],
        "topics": topics,
        "relationships": []
    })
}
