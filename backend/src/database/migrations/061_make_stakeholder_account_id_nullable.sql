-- Make account_id nullable on stakeholders table to support stakeholder de-association / multi-select.
ALTER TABLE stakeholders ALTER COLUMN account_id DROP NOT NULL;
