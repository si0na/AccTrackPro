-- Make opportunities.allocation_end_date nullable.
--
-- Background
-- ----------
-- The initial schema defined close_date as TEXT NOT NULL DEFAULT ''.
-- Migration 038 renamed close_date -> allocation_end_date, inheriting both the
-- NOT NULL constraint and the DEFAULT '' sentinel.  The service layer now sends
-- NULL for "no end date" (correct business rule: Expected Project End Date is
-- optional), but the NOT NULL constraint rejects it, producing a 500.
--
-- Fix
-- ---
-- 1. Drop the NOT NULL constraint (allow NULL).
-- 2. Remove the DEFAULT '' sentinel (NULL is now the canonical "not set" value).
-- 3. Convert existing empty-string rows to NULL so the column is consistent.
-- 4. Replace the date-ordering CHECK constraint, which previously accepted ''
--    as the "unset" sentinel, with a NULL-aware version.
-- 5. Recreate the partial index so it filters out NULLs correctly.
--
-- All statements are idempotent / guarded.

-- Step 1: Allow NULL (drop the NOT NULL constraint).
ALTER TABLE opportunities ALTER COLUMN allocation_end_date DROP NOT NULL;

-- Step 2: Remove the '' default — NULL is now canonical for "not set".
ALTER TABLE opportunities ALTER COLUMN allocation_end_date DROP DEFAULT;

-- Step 3: Convert existing empty-string sentinel values to NULL.
UPDATE opportunities
   SET allocation_end_date = NULL
 WHERE allocation_end_date = '';

-- Step 4: Replace the CHECK constraint with a NULL-aware version.
-- (The old constraint from migration 038 used  allocation_end_date = ''
--  as the "unset" branch — that branch is no longer needed.)
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_allocation_dates_order;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_allocation_dates_order') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_allocation_dates_order
      CHECK (
        allocation_end_date IS NULL
        OR allocation_start_date IS NULL
        OR allocation_end_date !~ '^\d{4}-\d{2}-\d{2}'
        OR allocation_end_date::DATE >= allocation_start_date
      ) NOT VALID;
  END IF;
END $$;

-- Step 5: Recreate the partial index (WHERE IS NOT NULL ensures NULLs are
-- excluded from the index, which is correct — NULLs need no date-based lookup).
DROP INDEX IF EXISTS idx_opp_allocation_end_date;
CREATE INDEX IF NOT EXISTS idx_opp_allocation_end_date
  ON opportunities(allocation_end_date)
  WHERE is_deleted = FALSE AND allocation_end_date IS NOT NULL;
