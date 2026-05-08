-- Document folders with nesting & categories
CREATE TABLE doc_folders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id       UUID NOT NULL REFERENCES knowledgebases(id) ON DELETE CASCADE,
    parent_id   UUID REFERENCES doc_folders(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    category    TEXT,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique folder names at root level (per KB)
CREATE UNIQUE INDEX uq_doc_folders_root_name ON doc_folders (kb_id, name) WHERE parent_id IS NULL;

-- Unique folder names within same parent
CREATE UNIQUE INDEX uq_doc_folders_nested_name ON doc_folders (kb_id, parent_id, name) WHERE parent_id IS NOT NULL;

CREATE INDEX idx_doc_folders_kb ON doc_folders (kb_id);
CREATE INDEX idx_doc_folders_parent ON doc_folders (parent_id);

-- Add folder_id to documents (nullable — NULL means root)
ALTER TABLE documents ADD COLUMN folder_id UUID REFERENCES doc_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_documents_folder ON documents (folder_id);
