-- Add UUID-based ownership FK columns to replace denormalised owner/user_name
-- TEXT columns. The legacy text columns are kept for display fallback until
-- every row is backfilled (see DatabaseService.backfillOwnerIds).

ALTER TABLE accounts      ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE action_items  ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE activities    ADD COLUMN IF NOT EXISTS user_id  TEXT;
ALTER TABLE comments      ADD COLUMN IF NOT EXISTS user_id  TEXT;

CREATE INDEX IF NOT EXISTS idx_acc_owner_id ON accounts(owner_id)      WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_opp_owner_id ON opportunities(owner_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ai_owner_id  ON action_items(owner_id)  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_act_user_id  ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_cmt_user_id  ON comments(user_id);

-- Apply FK constraints idempotently.
DO $fk_entity$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounts_owner') THEN
    ALTER TABLE accounts ADD CONSTRAINT fk_accounts_owner
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_opportunities_owner') THEN
    ALTER TABLE opportunities ADD CONSTRAINT fk_opportunities_owner
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_action_items_owner') THEN
    ALTER TABLE action_items ADD CONSTRAINT fk_action_items_owner
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_activities_user') THEN
    ALTER TABLE activities ADD CONSTRAINT fk_activities_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_user') THEN
    ALTER TABLE comments ADD CONSTRAINT fk_comments_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $fk_entity$;
