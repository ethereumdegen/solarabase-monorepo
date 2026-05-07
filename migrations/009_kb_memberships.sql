CREATE TYPE kb_role AS ENUM ('viewer', 'editor', 'admin');

CREATE TABLE kb_memberships (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id   UUID NOT NULL REFERENCES knowledgebases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role    kb_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(kb_id, user_id)
);

CREATE INDEX idx_kb_memberships_kb ON kb_memberships(kb_id);
CREATE INDEX idx_kb_memberships_user ON kb_memberships(user_id);
