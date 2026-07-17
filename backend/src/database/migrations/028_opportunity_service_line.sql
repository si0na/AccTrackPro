-- Add optional Service Line classification to opportunities — distinct from
-- the existing (mandatory, multi-select) Opportunity Area field, despite
-- overlapping values, per business requirement.
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS service_line TEXT;

DO $opp_service_line$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_service_line') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_service_line
      CHECK (service_line IS NULL OR service_line IN
        ('Data','AI','Cloud','Application Development','Application Support','Cyber Security','SharePoint'));
  END IF;
END $opp_service_line$;
