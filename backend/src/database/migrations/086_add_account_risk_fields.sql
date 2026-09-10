-- Migration 086: Add impact_description, contingency_plan, risk_open_date, and classification to account_risks table

ALTER TABLE account_risks ADD COLUMN IF NOT EXISTS impact_description TEXT;
ALTER TABLE account_risks ADD COLUMN IF NOT EXISTS contingency_plan TEXT;
ALTER TABLE account_risks ADD COLUMN IF NOT EXISTS risk_open_date DATE;
ALTER TABLE account_risks ADD COLUMN IF NOT EXISTS classification TEXT;
