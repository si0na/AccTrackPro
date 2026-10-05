-- Migration 109: Add impediments field to opportunities table.
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS impediments TEXT DEFAULT '';
