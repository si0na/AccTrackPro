-- Adds an optional Priority field to Opportunities.
-- Allowed values: High, Medium, Low — null means "not set", consistent with
-- the optional opportunityHealth field (migration 040).

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS priority TEXT;

DO $opp_priority$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_priority') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_priority
      CHECK (priority IS NULL OR priority IN ('High', 'Medium', 'Low'));
  END IF;
END $opp_priority$;

CREATE INDEX IF NOT EXISTS idx_opp_priority ON opportunities(priority) WHERE is_deleted = FALSE;
