-- Refactor opportunity timelines to support separate Allocation and Deal periods.
--
-- Renames existing date fields:
--   start_date              → allocation_start_date
--   end_date                → allocation_end_date
--
-- Adds new date fields:
--   deal_start_date         (new, nullable)
--   deal_close_date         (new, nullable)
--
-- Migrates existing data:
--   start_date              → allocation_start_date
--   end_date                → allocation_end_date
--   deal_start_date/deal_close_date remain NULL for existing opportunities

-- Step 1: Add new columns before renaming existing ones
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS deal_start_date DATE,
  ADD COLUMN IF NOT EXISTS deal_close_date DATE;

-- Step 2: Rename existing columns (PostgreSQL: rename via ADD new + copy + DROP old)
-- Add allocation_start_date and copy from start_date (cast TEXT to DATE)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS allocation_start_date DATE;
UPDATE opportunities SET allocation_start_date = NULLIF(start_date, '')::DATE WHERE allocation_start_date IS NULL AND start_date IS NOT NULL AND start_date != '';

-- Add allocation_end_date and copy from end_date (cast TEXT to DATE)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS allocation_end_date DATE;
UPDATE opportunities SET allocation_end_date = NULLIF(end_date, '')::DATE WHERE allocation_end_date IS NULL AND end_date IS NOT NULL AND end_date != '';

-- Step 3: Drop the old columns if they still exist (idempotent)
ALTER TABLE opportunities DROP COLUMN IF EXISTS start_date;
ALTER TABLE opportunities DROP COLUMN IF EXISTS end_date;

-- Step 4: Add date ordering constraints (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_allocation_dates_order') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_allocation_dates_order
      CHECK (allocation_end_date IS NULL OR allocation_start_date IS NULL OR allocation_end_date >= allocation_start_date);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_deal_dates_order') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_deal_dates_order
      CHECK (deal_close_date IS NULL OR deal_start_date IS NULL OR deal_close_date >= deal_start_date);
  END IF;
END $$;

-- Step 5: Create indexes on new columns for filtering/sorting performance
CREATE INDEX IF NOT EXISTS idx_opp_allocation_start_date ON opportunities(allocation_start_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_opp_allocation_end_date ON opportunities(allocation_end_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_opp_deal_start_date ON opportunities(deal_start_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_opp_deal_close_date ON opportunities(deal_close_date) WHERE is_deleted = FALSE;
