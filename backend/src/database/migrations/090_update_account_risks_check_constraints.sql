-- Migration 090: Allow 'Issue' in risk_type and 'In Progress', 'Resolved' in status for account_risks table

ALTER TABLE account_risks DROP CONSTRAINT IF EXISTS account_risks_risk_type_check;
ALTER TABLE account_risks ADD CONSTRAINT account_risks_risk_type_check CHECK (risk_type IN ('Risk', 'Dependency', 'Issue'));

ALTER TABLE account_risks DROP CONSTRAINT IF EXISTS account_risks_status_check;
ALTER TABLE account_risks ADD CONSTRAINT account_risks_status_check CHECK (status IN ('Open', 'Mitigated', 'Closed', 'Accepted', 'In Progress', 'Resolved'));
