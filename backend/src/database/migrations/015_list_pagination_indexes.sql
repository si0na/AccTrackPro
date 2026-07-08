-- Indexes supporting the list endpoints' ORDER BY created_at DESC (and the
-- new opt-in LIMIT/OFFSET pagination). Partial on is_deleted = FALSE to match
-- the queries exactly. activities/notifications already have created_at
-- indexes (001/002).
CREATE INDEX IF NOT EXISTS idx_acc_created ON accounts(created_at DESC)      WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_opp_created ON opportunities(created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ai_created  ON action_items(created_at DESC)  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_stk_created ON stakeholders(created_at DESC)  WHERE is_deleted = FALSE;

-- Duplicate-check lookups added to the services.
CREATE INDEX IF NOT EXISTS idx_acc_name_lower ON accounts(LOWER(name))                 WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_stk_acct_email ON stakeholders(account_id, LOWER(email)) WHERE is_deleted = FALSE;
