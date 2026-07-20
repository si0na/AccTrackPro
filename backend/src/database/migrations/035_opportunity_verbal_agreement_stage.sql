-- Add 'Verbal Agreement' as a valid pipeline stage, positioned in the business
-- flow between Negotiation and Won:
--   Lead → Qualified → Proposal → Negotiation → Verbal Agreement → Won
--
-- Purely additive: the existing eight stage values are preserved unchanged, so
-- existing opportunities are unaffected and remain valid. Only opportunities
-- explicitly moved to 'Verbal Agreement' will use the new value.
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_stage_check
  CHECK (stage IN (
    'Lead','Qualified','Proposal','Negotiation','Verbal Agreement','Won',
    'Blocked','Delayed','Lost'
  ));
