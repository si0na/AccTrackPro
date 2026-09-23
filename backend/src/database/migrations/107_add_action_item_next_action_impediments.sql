-- Migration 107: Add Next Action and Impediments fields to action_items table.

ALTER TABLE action_items ADD COLUMN IF NOT EXISTS next_action TEXT DEFAULT '';
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS impediments TEXT DEFAULT '';
