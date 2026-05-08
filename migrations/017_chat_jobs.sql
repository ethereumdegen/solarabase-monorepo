CREATE TABLE chat_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    kb_id       UUID NOT NULL REFERENCES knowledgebases(id) ON DELETE CASCADE,
    owner_id    UUID NOT NULL REFERENCES users(id),
    status      TEXT NOT NULL DEFAULT 'ready',
    worker_id   TEXT,
    content     TEXT NOT NULL,
    error       TEXT,
    claimed_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_jobs_status ON chat_jobs (status);
CREATE INDEX idx_chat_jobs_session ON chat_jobs (session_id);
