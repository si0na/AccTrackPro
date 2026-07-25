-- Corrects a mistake introduced by migration 037.
--
-- Migration 037 renamed a legacy `end_date` column to `allocation_end_date` to
-- back the new "Allocation End Date" field. But `end_date` was a dead column
-- that had never been exposed anywhere in the UI (no create field, no edit
-- field, no detail view). The column that actually held every opportunity's
-- real "Expected Close Date" value all along was `close_date` — migration 037
-- left it untouched and separate.
--
-- Result: any opportunity created or edited since the rename shows a blank
-- Allocation End Date, even though its real date is sitting in `close_date`.
--
-- Fix: drop the dead `allocation_end_date` column and rename `close_date` to
-- `allocation_end_date`, so the field is backed by the column that actually
-- holds user-entered data. `close_date` stays a TEXT column (unchanged type),
-- matching its original semantics (empty string = unset).

-- Step 1: Drop the ordering constraint that references the old (dead) column.
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_allocation_dates_order;

-- Step 2: Drop the dead allocation_end_date column (also drops its index).
ALTER TABLE opportunities DROP COLUMN IF EXISTS allocation_end_date;

-- Step 3: Rename close_date -> allocation_end_date, carrying its data and
-- index forward under the new name. Guarded so re-running is a no-op.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'close_date')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'allocation_end_date') THEN
    ALTER TABLE opportunities RENAME COLUMN close_date TO allocation_end_date;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_opp_close_date')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_opp_allocation_end_date') THEN
    ALTER INDEX idx_opp_close_date RENAME TO idx_opp_allocation_end_date;
  END IF;
END $$;

-- Step 4: Re-add the ordering constraint against the renamed (TEXT) column,
-- guarded for the empty-string "unset" sentinel and any malformed values.
-- Added NOT VALID: a handful of pre-existing test records have a close date
-- before their allocation start date, which would fail full validation. NOT
-- VALID skips checking existing rows but still enforces the rule on every
-- future insert/update.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_allocation_dates_order') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_allocation_dates_order
      CHECK (
        allocation_end_date = ''
        OR allocation_start_date IS NULL
        OR allocation_end_date !~ '^\d{4}-\d{2}-\d{2}'
        OR allocation_end_date::DATE >= allocation_start_date
      ) NOT VALID;
  END IF;
END $$;
