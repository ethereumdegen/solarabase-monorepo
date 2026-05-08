use std::sync::Arc;

use async_trait::async_trait;
use metalcraft::{
    create_react_agent, AgentState, CompiledGraph, Executor, GraphError,
    Result as McResult, RunOutcome, Tool, ToolRegistry,
};
use rig::client::CompletionClient;
use rig::providers::openai;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::db;
use crate::models::knowledgebase::Knowledgebase;

type BoxErr = Box<dyn std::error::Error + Send + Sync>;

// ---------------------------------------------------------------------------
// KB-scoped tools
// ---------------------------------------------------------------------------

struct ListDocumentsTool {
    db: PgPool,
    kb_id: Uuid,
}

#[async_trait]
impl Tool for ListDocumentsTool {
    fn name(&self) -> &str {
        "list_documents"
    }
    fn description(&self) -> &str {
        "List all indexed documents in this knowledge base. Returns document IDs, filenames, page counts, and status."
    }
    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {},
            "required": []
        })
    }
    async fn call(&self, _args: serde_json::Value) -> McResult<serde_json::Value> {
        let docs = db::documents::list_for_kb(&self.db, self.kb_id)
            .await
            .map_err(|e| GraphError::Node {
                node: "list_documents".into(),
                message: e.to_string(),
            })?;

        let results: Vec<serde_json::Value> = docs
            .iter()
            .filter(|d| matches!(d.status, crate::models::document::DocStatus::Indexed))
            .map(|d| {
                json!({
                    "id": d.id.to_string(),
                    "filename": d.filename,
                    "page_count": d.page_count,
                })
            })
            .collect();

        Ok(json!({ "documents": results, "count": results.len() }))
    }
}

struct SearchIndexTool {
    db: PgPool,
    kb_id: Uuid,
}

#[async_trait]
impl Tool for SearchIndexTool {
    fn name(&self) -> &str {
        "search_index"
    }
    fn description(&self) -> &str {
        "Search for relevant pages across indexed documents. Returns matching entities and page_map sections scored by keyword relevance. Use specific terms, acronyms, and keywords for best results. Optionally scope to a single document_id."
    }
    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query or topic to find"
                },
                "document_id": {
                    "type": "string",
                    "description": "Optional: specific document UUID to search. If omitted, searches all documents in this KB."
                }
            },
            "required": ["query"]
        })
    }
    async fn call(&self, args: serde_json::Value) -> McResult<serde_json::Value> {
        let query = args["query"].as_str().unwrap_or("");
        let query_lower = query.to_lowercase();
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();
        let doc_id = args["document_id"].as_str();

        let indexes = if let Some(id_str) = doc_id {
            let id = Uuid::parse_str(id_str).map_err(|e| GraphError::Node {
                node: "search_index".into(),
                message: format!("invalid document_id: {e}"),
            })?;
            match db::page_indexes::get_document_index(&self.db, id)
                .await
                .map_err(|e| GraphError::Node {
                    node: "search_index".into(),
                    message: e.to_string(),
                })? {
                Some(idx) => vec![idx],
                None => vec![],
            }
        } else {
            db::page_indexes::get_document_indexes_for_kb(&self.db, self.kb_id)
                .await
                .map_err(|e| GraphError::Node {
                    node: "search_index".into(),
                    message: e.to_string(),
                })?
        };

        let mut all_hits: Vec<serde_json::Value> = Vec::new();

        for idx in &indexes {
            let doc_id_str = idx.document_id.to_string();

            // Score entity_index matches (exact entity name matching)
            let mut entity_hits: Vec<serde_json::Value> = Vec::new();
            if let Some(entity_index) = idx.root_index.get("entity_index").and_then(|v| v.as_object()) {
                for (entity_name, pages) in entity_index {
                    let entity_lower = entity_name.to_lowercase();
                    // Match if any query word matches entity name or entity contains query term
                    let matched = query_words.iter().any(|w| {
                        entity_lower.contains(w) || w.contains(entity_lower.as_str())
                    });
                    if matched {
                        entity_hits.push(json!({
                            "entity": entity_name,
                            "pages": pages,
                        }));
                    }
                }
            }

            // Score page_map entries by keyword overlap
            let mut page_map_hits: Vec<serde_json::Value> = Vec::new();
            if let Some(page_map) = idx.root_index.get("page_map").and_then(|v| v.as_array()) {
                for entry in page_map {
                    let theme = entry.get("theme").and_then(|v| v.as_str()).unwrap_or("");
                    let keywords: Vec<&str> = entry
                        .get("relevance_keywords")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|k| k.as_str()).collect())
                        .unwrap_or_default();

                    let theme_lower = theme.to_lowercase();
                    let keywords_lower: String = keywords.join(" ").to_lowercase();
                    let searchable = format!("{} {}", theme_lower, keywords_lower);

                    let score: usize = query_words
                        .iter()
                        .filter(|w| searchable.contains(*w))
                        .count();

                    if score > 0 {
                        page_map_hits.push(json!({
                            "theme": theme,
                            "pages": entry.get("pages"),
                            "relevance_keywords": keywords,
                            "score": score,
                        }));
                    }
                }
            }

            // Sort page_map hits by score descending
            page_map_hits.sort_by(|a, b| {
                let sa = a["score"].as_u64().unwrap_or(0);
                let sb = b["score"].as_u64().unwrap_or(0);
                sb.cmp(&sa)
            });

            if !entity_hits.is_empty() || !page_map_hits.is_empty() {
                let summary = idx.root_index.get("summary").and_then(|v| v.as_str()).unwrap_or("");
                all_hits.push(json!({
                    "document_id": doc_id_str,
                    "document_summary": summary,
                    "entity_matches": entity_hits,
                    "page_map_matches": page_map_hits,
                }));
            }
        }

        // If no filtered hits, return summary-level info so agent knows what's available
        if all_hits.is_empty() {
            let summaries: Vec<serde_json::Value> = indexes
                .iter()
                .map(|idx| json!({
                    "document_id": idx.document_id.to_string(),
                    "summary": idx.root_index.get("summary").and_then(|v| v.as_str()).unwrap_or(""),
                    "key_themes": idx.root_index.get("key_themes").cloned().unwrap_or(json!([])),
                }))
                .collect();
            return Ok(json!({
                "matches": [],
                "no_direct_matches": true,
                "hint": "No entity or keyword matches found. Try broader terms, or use read_page to scan specific pages. Here are the available documents:",
                "available_documents": summaries,
            }));
        }

        Ok(json!({ "matches": all_hits }))
    }
}

struct SearchPagesTool {
    db: PgPool,
    kb_id: Uuid,
}

#[async_trait]
impl Tool for SearchPagesTool {
    fn name(&self) -> &str {
        "search_pages"
    }
    fn description(&self) -> &str {
        "Full-text search across actual page content. Use for specific terms, acronyms, names, or phrases that may not appear in the index metadata. Returns ranked snippets with highlighted matches."
    }
    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query — supports natural language, exact phrases in quotes, and boolean operators (OR, -exclude)"
                }
            },
            "required": ["query"]
        })
    }
    async fn call(&self, args: serde_json::Value) -> McResult<serde_json::Value> {
        let query = args["query"].as_str().unwrap_or("");
        if query.trim().is_empty() {
            return Ok(json!({ "error": "query is required" }));
        }

        let hits = db::page_indexes::search_pages_fts(&self.db, self.kb_id, query, 10)
            .await
            .map_err(|e| GraphError::Node {
                node: "search_pages".into(),
                message: e.to_string(),
            })?;

        let results: Vec<serde_json::Value> = hits
            .into_iter()
            .map(|h| {
                json!({
                    "document_id": h.document_id.to_string(),
                    "filename": h.filename,
                    "page_num": h.page_num,
                    "rank": h.rank,
                    "snippet": h.snippet,
                })
            })
            .collect();

        Ok(json!({ "results": results, "count": results.len() }))
    }
}

struct ReadPageTool {
    db: PgPool,
    kb_id: Uuid,
}

#[async_trait]
impl Tool for ReadPageTool {
    fn name(&self) -> &str {
        "read_page"
    }
    fn description(&self) -> &str {
        "Read the full text content of a specific page from a document. Use after search_index to retrieve pages identified as relevant."
    }
    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "document_id": {
                    "type": "string",
                    "description": "The document UUID"
                },
                "page_num": {
                    "type": "integer",
                    "description": "The page number to read (1-based)"
                }
            },
            "required": ["document_id", "page_num"]
        })
    }
    async fn call(&self, args: serde_json::Value) -> McResult<serde_json::Value> {
        let doc_id_str = args["document_id"]
            .as_str()
            .ok_or_else(|| GraphError::Node {
                node: "read_page".into(),
                message: "document_id required".into(),
            })?;
        let doc_id = Uuid::parse_str(doc_id_str).map_err(|e| GraphError::Node {
            node: "read_page".into(),
            message: format!("invalid document_id: {e}"),
        })?;
        let page_num = args["page_num"].as_i64().unwrap_or(1) as i32;

        // Scoped read: verify document belongs to this KB
        let page = db::page_indexes::get_page_scoped(&self.db, self.kb_id, doc_id, page_num)
            .await
            .map_err(|e| GraphError::Node {
                node: "read_page".into(),
                message: e.to_string(),
            })?;

        match page {
            Some(p) => Ok(json!({
                "document_id": doc_id.to_string(),
                "page_num": p.page_num,
                "content": p.content,
                "tree_index": p.tree_index,
            })),
            None => Ok(json!({
                "error": format!("page {page_num} not found in document {doc_id}")
            })),
        }
    }
}

// ---------------------------------------------------------------------------
// RAG Agent builder (per-KB factory)
// ---------------------------------------------------------------------------

fn build_system_prompt(kb: &Knowledgebase) -> String {
    let mut prompt = format!(
        "You are the {} assistant that answers questions using indexed documents.\n\n",
        kb.name
    );

    if !kb.system_prompt.is_empty() {
        prompt.push_str(&kb.system_prompt);
        prompt.push_str("\n\n");
    }

    prompt.push_str(
        r#"You have two complementary search tools — use BOTH for best results:

1. `search_index` — searches document metadata (entity index, page themes, keywords). Good for finding which sections/topics cover a subject.
2. `search_pages` — full-text search on actual page content. Good for specific terms, acronyms, names, exact phrases, and anything the index may have missed.

Retrieval process:
1. Run `search_index` AND `search_pages` in parallel with keywords from the user's question.
2. Review results from both — entity matches, page_map hits, and content snippets.
3. Use `read_page` to get full content of the most relevant pages identified by either tool.
4. Synthesize an answer from the retrieved content.
5. If no matches, try synonyms, broader terms, or `list_documents` to browse available docs.

Important:
- Always cite sources: mention document filename and page number
- If information spans multiple pages, read all relevant pages before answering
- If no relevant content is found, say so honestly — do not guess
- Prefer fewer, targeted tool calls over exhaustive scanning"#,
    );

    prompt
}

pub struct RagAgent {
    graph: Arc<CompiledGraph<AgentState>>,
}

impl RagAgent {
    pub fn new_for_kb(
        api_key: &str,
        kb: &Knowledgebase,
        db: PgPool,
    ) -> Result<Self, BoxErr> {
        let client = openai::Client::new(api_key)?;
        let model = client.completion_model(&kb.model);

        let kb_id = kb.id;
        let registry = ToolRegistry::new()
            .register(ListDocumentsTool { db: db.clone(), kb_id })
            .register(SearchIndexTool { db: db.clone(), kb_id })
            .register(SearchPagesTool { db: db.clone(), kb_id })
            .register(ReadPageTool { db, kb_id });

        let system_prompt = build_system_prompt(kb);
        let graph = create_react_agent(model, registry, &system_prompt)?;

        Ok(Self {
            graph: Arc::new(graph),
        })
    }

    pub async fn query(&self, question: &str) -> Result<RagResponse, BoxErr> {
        let executor = Executor::new_from_arc(self.graph.clone()).max_steps(15);
        let state = AgentState::new(question);
        let thread_id = format!("query-{}", Uuid::new_v4());

        let outcome = executor.run(state, &thread_id).await?;

        match outcome {
            RunOutcome::Completed(state) => {
                let answer = state
                    .final_answer()
                    .unwrap_or("No answer could be generated.")
                    .to_string();

                let tools_called = state.tools_called();
                let reasoning_path: Vec<String> = state
                    .turns()
                    .iter()
                    .filter(|t| !t.tool_calls.is_empty())
                    .map(|t| {
                        t.tool_calls
                            .iter()
                            .map(|tc| format!("{}({})", tc.name, tc.args))
                            .collect::<Vec<_>>()
                            .join(" → ")
                    })
                    .collect();

                Ok(RagResponse {
                    answer,
                    reasoning_path,
                    tools_used: tools_called,
                })
            }
            RunOutcome::Interrupted { reason, .. } => Ok(RagResponse {
                answer: format!("Query interrupted: {reason}"),
                reasoning_path: vec![],
                tools_used: vec![],
            }),
        }
    }
}

#[derive(Debug, serde::Serialize)]
pub struct RagResponse {
    pub answer: String,
    pub reasoning_path: Vec<String>,
    pub tools_used: Vec<String>,
}
