CREATE TYPE doc_status AS ENUM ('uploaded', 'processing', 'indexed', 'failed');

CREATE TABLE documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id       UUID NOT NULL REFERENCES knowledgebases(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    s3_key      TEXT NOT NULL UNIQUE,
    size_bytes  BIGINT NOT NULL,
    status      doc_status NOT NULL DEFAULT 'uploaded',
    page_count  INT,
    error_msg   TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE page_indexes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_num    INT NOT NULL,
    content     TEXT NOT NULL,
    tree_index  JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, page_num)
);

CREATE TABLE document_indexes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE UNIQUE,
    root_index  JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_kb ON documents(kb_id);
CREATE INDEX idx_page_indexes_doc ON page_indexes(document_id);
