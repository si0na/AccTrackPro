-- Extend opportunities with new lifecycle statuses (Blocked, Delayed), an
-- AOP Year field (availability flag + conditional year), a mandatory
-- Opportunity Type, and a mandatory multi-select Opportunity Area.

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_status;
ALTER TABLE opportunities ADD CONSTRAINT chk_opp_status
  CHECK (status IN ('Open','Won','Lost','Blocked','Delayed'));

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS aop_available BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS aop_year TEXT;

DO $opp_aop$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_aop_year_format') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_aop_year_format
      CHECK (aop_year IS NULL OR aop_year ~ '^[0-9]{4}$');
  END IF;
END $opp_aop$;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS opportunity_type TEXT NOT NULL DEFAULT 'Growth';

DO $opp_type$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_type') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_type
      CHECK (opportunity_type IN ('Growth','Pursuit','Whitespace'));
  END IF;
END $opp_type$;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS opportunity_area TEXT[] NOT NULL DEFAULT '{}';

DO $opp_area$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_area') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_area
      CHECK (opportunity_area <@ ARRAY['Data','AI','Application Development','Application Support','Infrastructure','Cybersecurity','SharePoint']::TEXT[]);
  END IF;
END $opp_area$;

CREATE INDEX IF NOT EXISTS idx_opp_type ON opportunities(opportunity_type) WHERE is_deleted = FALSE;
