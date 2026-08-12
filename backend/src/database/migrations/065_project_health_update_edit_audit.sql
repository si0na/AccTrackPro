-- Health Tracker entries can now be corrected from the tracker UI.
-- The table stays an audit trail, so record the edit rather than hide it:
-- edited_at IS NULL means the entry is exactly as first written, and
-- created_at is never touched so the trail keeps its original ordering.
ALTER TABLE project_health_updates
  ADD COLUMN edited_at TIMESTAMPTZ,
  ADD COLUMN edited_by_id TEXT REFERENCES users(id) ON DELETE SET NULL;
