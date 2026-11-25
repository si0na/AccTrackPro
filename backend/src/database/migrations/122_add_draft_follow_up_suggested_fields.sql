-- Migration 115: Persist suggested_due_date and suggested_priority on
-- stakeholder_connect_draft_follow_ups to align PostgreSQL with the UI/DTO contract.

ALTER TABLE stakeholder_connect_draft_follow_ups
  ADD COLUMN IF NOT EXISTS suggested_due_date DATE,
  ADD COLUMN IF NOT EXISTS suggested_priority VARCHAR(20);

ALTER TABLE stakeholder_connect_draft_follow_ups
  DROP CONSTRAINT IF EXISTS chk_stk_conn_draft_priority;

ALTER TABLE stakeholder_connect_draft_follow_ups
  ADD CONSTRAINT chk_stk_conn_draft_priority
  CHECK (suggested_priority IS NULL OR suggested_priority IN ('High', 'Medium', 'Low'));

