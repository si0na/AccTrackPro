-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Date-driven fiscal model
-- Date:      2026-07-04
--
-- Financial Year and Quarter are no longer stored on business entities. They
-- are derived at read/report time from business dates using the configured
-- Financial Calendar (financial_calendar + financial_years tables):
--
--   • Opportunities  → derived from close_date
--   • Action items   → derived from due_date
--   • Activities     → derived from created_at (audit-log reporting)
--   • Accounts / Stakeholders / Documents / Notifications
--                    → no fiscal dimension at all; never period-filtered
--
-- Data preservation: the authoritative business dates (close_date, due_date,
-- created_at) already exist on every row, so dropping the stored
-- financial_year/quarter columns loses no information — the fiscal period of
-- every historical record is recomputed from its date on demand.
--
-- NOTE: the application also applies these statements idempotently at startup
-- (backend/src/database/database.service.ts). This script exists for running
-- the migration manually against a managed database.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Drop legacy fiscal-period indexes
DROP INDEX IF EXISTS idx_opp_fy;
DROP INDEX IF EXISTS idx_acc_fy;
DROP INDEX IF EXISTS idx_ai_fy;
DROP INDEX IF EXISTS idx_stk_fy;

-- 2. Drop stored fiscal-period columns from all business entities
ALTER TABLE accounts      DROP COLUMN IF EXISTS financial_year;
ALTER TABLE accounts      DROP COLUMN IF EXISTS quarter;
ALTER TABLE opportunities DROP COLUMN IF EXISTS financial_year;
ALTER TABLE opportunities DROP COLUMN IF EXISTS quarter;
ALTER TABLE action_items  DROP COLUMN IF EXISTS financial_year;
ALTER TABLE action_items  DROP COLUMN IF EXISTS quarter;
ALTER TABLE stakeholders  DROP COLUMN IF EXISTS financial_year;
ALTER TABLE stakeholders  DROP COLUMN IF EXISTS quarter;

-- 3. Index the business dates that now back fiscal-period range filters
CREATE INDEX IF NOT EXISTS idx_opp_close_date ON opportunities(close_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ai_due_date    ON action_items(due_date)    WHERE is_deleted = FALSE;

-- 4. Remove markers of the retired FY-stamping backfills
DELETE FROM administration_settings
 WHERE key IN ('fy_global_period_migration_v1', 'fy_ai_stk_migration_v1');

-- The Financial Calendar configuration is intentionally KEPT:
--   financial_calendar               — global start month + quarter definitions
--   financial_years                  — selector options, with per-FY calendar
--   financial_years.calendar_*       — snapshot so historical quarters never
--                                      shift when the global calendar changes
COMMIT;
