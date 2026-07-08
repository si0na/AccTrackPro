-- Drop legacy stored fiscal-year/quarter columns and replace with date-based indexes.
--
-- Financial Year and Quarter are never stored on business entities. They are
-- derived from business dates (opportunities.close_date, action_items.due_date)
-- using the configured Financial Calendar. Drop the legacy stored columns and
-- their indexes; the date columns already carry the authoritative information.

DROP INDEX IF EXISTS idx_opp_fy;
DROP INDEX IF EXISTS idx_acc_fy;
DROP INDEX IF EXISTS idx_ai_fy;
DROP INDEX IF EXISTS idx_stk_fy;

ALTER TABLE accounts      DROP COLUMN IF EXISTS financial_year;
ALTER TABLE accounts      DROP COLUMN IF EXISTS quarter;
ALTER TABLE opportunities DROP COLUMN IF EXISTS financial_year;
ALTER TABLE opportunities DROP COLUMN IF EXISTS quarter;
ALTER TABLE action_items  DROP COLUMN IF EXISTS financial_year;
ALTER TABLE action_items  DROP COLUMN IF EXISTS quarter;
ALTER TABLE stakeholders  DROP COLUMN IF EXISTS financial_year;
ALTER TABLE stakeholders  DROP COLUMN IF EXISTS quarter;

-- Business-date indexes backing the derived fiscal-period range filters.
CREATE INDEX IF NOT EXISTS idx_opp_close_date ON opportunities(close_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ai_due_date    ON action_items(due_date)    WHERE is_deleted = FALSE;
