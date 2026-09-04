-- Add 'Hold' as a valid opportunity stage
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_stage_check
  CHECK (stage IN (
    'Lead','Qualified','Proposal','Negotiation','Verbal Agreement','Won',
    'Blocked','Delayed','Hold','Lost'
  ));
