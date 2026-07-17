-- Remove the separate opportunity 'status' field — Won/Lost outcomes are now
-- tracked solely through 'stage' (which already includes Won/Lost, per 027).
DROP INDEX IF EXISTS idx_opp_status;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_status;
ALTER TABLE opportunities DROP COLUMN IF EXISTS status;
