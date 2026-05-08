-- Global app settings (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default KB model
INSERT INTO app_settings (key, value)
VALUES ('default_kb_model', 'gpt-5.4')
ON CONFLICT DO NOTHING;

-- Update the column default to match
ALTER TABLE knowledgebases ALTER COLUMN model SET DEFAULT 'gpt-5.4';
