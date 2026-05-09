-- LLM API call logs for admin observability
CREATE TABLE IF NOT EXISTS llm_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id       UUID REFERENCES knowledgebases(id) ON DELETE SET NULL,
    session_id  UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    request_type TEXT NOT NULL,          -- 'complete', 'complete_json', 'navigate_tree', 'index_page'
    model       TEXT NOT NULL,
    input_chars  INT NOT NULL DEFAULT 0, -- approximate input size
    output_chars INT NOT NULL DEFAULT 0, -- approximate output size
    latency_ms  INT NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'success', -- 'success' or 'error'
    error_msg   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_logs_kb_id ON llm_logs(kb_id);
CREATE INDEX idx_llm_logs_created_at ON llm_logs(created_at DESC);
CREATE INDEX idx_llm_logs_request_type ON llm_logs(request_type);
