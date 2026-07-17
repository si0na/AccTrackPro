-- Account Type / Health standardization + Location field.
-- Type:   Growth/Pursuit/Project   -> New/Strategic/Non Strategic
-- Health: Healthy/At Risk/Critical -> Green/Amber/Red
-- Existing rows are remapped (not reset) so historical classification survives.

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';

-- Old constraints must go first — they don't allow the new values, so
-- remapping rows under them would fail.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_health_check;

UPDATE accounts SET type = CASE type
  WHEN 'Growth'  THEN 'New'
  WHEN 'Pursuit' THEN 'Strategic'
  WHEN 'Project' THEN 'Non Strategic'
  ELSE type END
WHERE type IN ('Growth','Pursuit','Project');

UPDATE accounts SET health = CASE health
  WHEN 'Healthy'  THEN 'Green'
  WHEN 'At Risk'  THEN 'Amber'
  WHEN 'Critical' THEN 'Red'
  ELSE health END
WHERE health IN ('Healthy','At Risk','Critical');

ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('Strategic','Non Strategic','New'));

ALTER TABLE accounts ADD CONSTRAINT accounts_health_check
  CHECK (health IN ('Green','Amber','Red'));
