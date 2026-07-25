-- Extends the Service Line master list with 8 new values while retaining
-- every existing value — no data loss, existing opportunities keep
-- validating against the widened CHECK constraint unchanged.
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_service_line;
ALTER TABLE opportunities ADD CONSTRAINT chk_opp_service_line
  CHECK (service_line IS NULL OR service_line IN (
    'Data','AI','Cloud','Application Development','Application Support','Infrastructure',
    'Cyber Security','SharePoint',
    'Consulting','UI/UX','Digital','Database','Testing','Project Management','Architecture',
    'Packaged Applications'
  ));
