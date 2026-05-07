CREATE TABLE wiki_pages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id       UUID NOT NULL REFERENCES knowledgebases(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    slug        TEXT NOT NULL,
    title       TEXT NOT NULL,
    summary     TEXT,
    content_s3_key TEXT NOT NULL,
    page_type   TEXT NOT NULL DEFAULT 'concept',
    sources     JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(kb_id, slug)
);

CREATE INDEX idx_wiki_pages_kb ON wiki_pages(kb_id);
