-- Phase 1: Full-text search on page content
ALTER TABLE page_indexes ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_page_content_fts ON page_indexes USING GIN(content_tsv);
