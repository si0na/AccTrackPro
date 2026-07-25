-- Action Item Owner becomes a reference to the Account's Stakeholders (Client
-- or Service Provider) instead of free text, matching the FK-based assignment
-- pattern already used for Opportunity client/service-provider stakeholders.
--
-- The legacy `owner` text column is kept (now nullable) purely as a read-only
-- fallback label for historical rows a name-match backfill couldn't resolve —
-- the app never writes to it again after this migration.

ALTER TABLE action_items ADD COLUMN IF NOT EXISTS owner_stakeholder_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_owner_stakeholder') THEN
    ALTER TABLE action_items ADD CONSTRAINT fk_ai_owner_stakeholder
      FOREIGN KEY (owner_stakeholder_id) REFERENCES stakeholders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_owner_stakeholder ON action_items(owner_stakeholder_id) WHERE is_deleted = FALSE;

-- Best-effort backfill: match each action item's free-text owner to the one
-- stakeholder on the same account with an identical (trimmed, case-insensitive)
-- name. Ambiguous (multiple matches) or unmatched rows are left NULL and keep
-- showing their legacy `owner` text until a user reassigns them via Edit.
UPDATE action_items ai
SET owner_stakeholder_id = matched.id
FROM (
  SELECT s.account_id, LOWER(TRIM(s.name)) AS lc_name, MIN(s.id) AS id, COUNT(*) AS match_count
  FROM stakeholders s
  WHERE s.is_deleted = FALSE
  GROUP BY s.account_id, LOWER(TRIM(s.name))
) matched
WHERE ai.owner_stakeholder_id IS NULL
  AND ai.is_deleted = FALSE
  AND matched.account_id = ai.account_id
  AND matched.lc_name = LOWER(TRIM(ai.owner))
  AND matched.match_count = 1;

ALTER TABLE action_items ALTER COLUMN owner DROP NOT NULL;
