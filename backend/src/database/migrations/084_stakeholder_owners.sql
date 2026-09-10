-- Migration 084: Add Primary, Secondary, and Third Owner columns to stakeholders table
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS primary_owner_id TEXT REFERENCES stakeholders(id) ON DELETE SET NULL;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS secondary_owner_id TEXT REFERENCES stakeholders(id) ON DELETE SET NULL;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS tertiary_owner_id TEXT REFERENCES stakeholders(id) ON DELETE SET NULL;
