-- Revert the Blocked/Delayed status expansion (024) — those states move to
-- Stage instead, per business decision. No data remap needed: zero live rows
-- currently use status Blocked/Delayed.
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_status;
UPDATE opportunities SET status = 'Open' WHERE status IN ('Blocked', 'Delayed');
ALTER TABLE opportunities ADD CONSTRAINT chk_opp_status
  CHECK (status IN ('Open', 'Won', 'Lost'));

-- Add Blocked, Delayed, Lost to Stage (additive — existing 5 values kept).
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_stage_check
  CHECK (stage IN ('Lead','Qualified','Proposal','Negotiation','Won','Blocked','Delayed','Lost'));
