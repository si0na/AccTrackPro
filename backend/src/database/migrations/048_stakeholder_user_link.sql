-- Link Service Provider stakeholders back to the user they represent.
--
-- When an Account Manager creates an Account they are auto-registered as a
-- SERVICE_PROVIDER stakeholder on that account. This nullable user_id ties those
-- auto-created rows to their user so we can:
--   * reuse the stored phone across future accounts,
--   * prevent duplicate Service Provider stakeholders per (account, user),
--   * propagate identity-field edits from the users table.
--
-- ON DELETE SET NULL: hard-deleting a user (rare) never removes historical
-- stakeholder rows — it only detaches the link, preserving audit/reporting data.

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS user_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_stk_user') THEN
    ALTER TABLE stakeholders ADD CONSTRAINT fk_stk_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stk_user ON stakeholders(user_id) WHERE is_deleted = FALSE;
