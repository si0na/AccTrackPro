-- Service Line becomes the single classification field for opportunities:
-- drop the mandatory multi-select Opportunity Area field entirely, add
-- Infrastructure to Service Line's allowed values, and tighten AOP Year from
-- a bare 4-digit year to a YYYY-YYYY fiscal-range format.

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_area;
ALTER TABLE opportunities DROP COLUMN IF EXISTS opportunity_area;

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_service_line;
ALTER TABLE opportunities ADD CONSTRAINT chk_opp_service_line
  CHECK (service_line IS NULL OR service_line IN
    ('Data','AI','Cloud','Application Development','Application Support','Infrastructure','Cyber Security','SharePoint'));

-- Backfill legacy bare 4-digit AOP years (e.g. '2026') to the new YYYY-YYYY
-- format (e.g. '2026-2027') before tightening the CHECK constraint, so
-- existing production data keeps satisfying it.
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_aop_year_format;

UPDATE opportunities
SET aop_year = aop_year || '-' || (aop_year::INT + 1)::TEXT
WHERE aop_year ~ '^[0-9]{4}$';

ALTER TABLE opportunities ADD CONSTRAINT chk_opp_aop_year_format
  CHECK (aop_year IS NULL OR aop_year ~ '^[0-9]{4}-[0-9]{4}$');
