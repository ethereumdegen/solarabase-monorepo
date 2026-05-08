-- Move billing from user-level to KB-level.
-- Each KB gets its own subscription and usage tracking.

-- 1. Subscriptions: add kb_id, populate from existing rows
ALTER TABLE subscriptions ADD COLUMN kb_id UUID REFERENCES knowledgebases(id) ON DELETE CASCADE;

-- Populate: assign each user's subscription to their first KB
UPDATE subscriptions SET kb_id = (
  SELECT k.id FROM knowledgebases k
  WHERE k.owner_id = subscriptions.user_id
  ORDER BY k.created_at
  LIMIT 1
);

-- Delete orphaned subscriptions (user has no KBs)
DELETE FROM subscriptions WHERE kb_id IS NULL;

ALTER TABLE subscriptions ALTER COLUMN kb_id SET NOT NULL;
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_user_id_key;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_kb_id_key UNIQUE (kb_id);

-- 2. Usage records: add kb_id, populate similarly
ALTER TABLE usage_records ADD COLUMN kb_id UUID REFERENCES knowledgebases(id) ON DELETE CASCADE;

UPDATE usage_records SET kb_id = (
  SELECT k.id FROM knowledgebases k
  WHERE k.owner_id = usage_records.user_id
  ORDER BY k.created_at
  LIMIT 1
);

DELETE FROM usage_records WHERE kb_id IS NULL;

ALTER TABLE usage_records ALTER COLUMN kb_id SET NOT NULL;
ALTER TABLE usage_records DROP CONSTRAINT usage_records_user_id_metric_period_start_key;
ALTER TABLE usage_records ADD CONSTRAINT usage_records_kb_id_metric_period_start_key UNIQUE (kb_id, metric, period_start);

-- 3. Indexes
CREATE INDEX idx_subscriptions_kb ON subscriptions(kb_id);
CREATE INDEX idx_usage_records_kb ON usage_records(kb_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
