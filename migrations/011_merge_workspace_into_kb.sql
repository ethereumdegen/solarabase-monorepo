-- 1. Add owner_id to knowledgebases (populated from workspace)
ALTER TABLE knowledgebases ADD COLUMN owner_id UUID REFERENCES users(id);
UPDATE knowledgebases SET owner_id = (SELECT owner_id FROM workspaces WHERE workspaces.id = knowledgebases.workspace_id);
ALTER TABLE knowledgebases ALTER COLUMN owner_id SET NOT NULL;

-- 2. Make KB slug globally unique (drop old composite, add global)
ALTER TABLE knowledgebases DROP CONSTRAINT knowledgebases_workspace_id_slug_key;
ALTER TABLE knowledgebases ADD CONSTRAINT knowledgebases_slug_key UNIQUE (slug);

-- 3. Subscriptions: workspace_id -> user_id
ALTER TABLE subscriptions ADD COLUMN user_id UUID REFERENCES users(id);
UPDATE subscriptions SET user_id = (SELECT owner_id FROM workspaces WHERE workspaces.id = subscriptions.workspace_id);
ALTER TABLE subscriptions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_workspace_id_key;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
ALTER TABLE subscriptions DROP COLUMN workspace_id;

-- 4. Usage records: workspace_id -> user_id
ALTER TABLE usage_records ADD COLUMN user_id UUID REFERENCES users(id);
UPDATE usage_records SET user_id = (SELECT owner_id FROM workspaces WHERE workspaces.id = usage_records.workspace_id);
ALTER TABLE usage_records ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE usage_records DROP CONSTRAINT usage_records_workspace_id_metric_period_start_key;
ALTER TABLE usage_records ADD CONSTRAINT usage_records_user_id_metric_period_start_key UNIQUE (user_id, metric, period_start);
ALTER TABLE usage_records DROP COLUMN workspace_id;

-- 5. Invitations: workspace_id -> kb_id, role type -> kb_role
ALTER TABLE invitations ADD COLUMN kb_id UUID REFERENCES knowledgebases(id);
-- Migrate: assign invitations to first KB in their workspace (best effort)
UPDATE invitations SET kb_id = (
  SELECT k.id FROM knowledgebases k WHERE k.workspace_id = invitations.workspace_id ORDER BY k.created_at LIMIT 1
);
-- Delete orphaned invitations (workspace had no KBs)
DELETE FROM invitations WHERE kb_id IS NULL;
ALTER TABLE invitations ALTER COLUMN kb_id SET NOT NULL;
ALTER TABLE invitations DROP CONSTRAINT invitations_workspace_id_email_key;
ALTER TABLE invitations ADD CONSTRAINT invitations_kb_id_email_key UNIQUE (kb_id, email);
ALTER TABLE invitations DROP COLUMN workspace_id;
-- Change role column from workspace_role to kb_role
ALTER TABLE invitations ALTER COLUMN role TYPE kb_role USING
  CASE role::text WHEN 'owner' THEN 'admin'::kb_role WHEN 'admin' THEN 'admin'::kb_role WHEN 'member' THEN 'editor'::kb_role END;

-- 6. Drop workspace_id from knowledgebases
ALTER TABLE knowledgebases DROP COLUMN workspace_id;

-- 7. Drop workspace tables
DROP TABLE memberships;
DROP TABLE workspaces;

-- 8. Drop workspace_role enum (no longer used)
DROP TYPE workspace_role;
