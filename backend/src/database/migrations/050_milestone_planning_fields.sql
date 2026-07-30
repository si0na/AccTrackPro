-- Milestone planning fields.
--
-- The Create Milestone form is being simplified to capture only essential
-- planning information up front. Those planning fields did not previously exist
-- on project_milestones, so they are added here. NOTHING is removed — every
-- existing column (sprints, planned/actual dates, status, effort, cost,
-- completion_pct, remarks) is retained and remains editable from the milestone
-- detail/edit dialog. Only the user experience changes; the model only grows.
--
-- New columns:
--   • milestone_no        — human-facing identifier/sequence, e.g. "M1", "1.0".
--   • activities          — scope: work performed to reach the milestone.
--   • deliverables        — scope: tangible outputs of the milestone.
--   • acceptance_criteria — quality: conditions for sign-off.
--   • payment_trigger     — payment: event that releases the payment.
--   • payment_pct         — payment: percentage of contract value (0–100).
--   • payment_amount      — payment: monetary amount.
--   • target_date         — schedule: planned target/due date.
--
-- All are nullable and additive, so existing milestone rows continue to
-- function unchanged (Scenario 4: no data loss). Idempotent via IF NOT EXISTS.

ALTER TABLE project_milestones
  ADD COLUMN IF NOT EXISTS milestone_no        TEXT,
  ADD COLUMN IF NOT EXISTS activities          TEXT,
  ADD COLUMN IF NOT EXISTS deliverables        TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT,
  ADD COLUMN IF NOT EXISTS payment_trigger     TEXT,
  ADD COLUMN IF NOT EXISTS payment_pct         NUMERIC(5,2)  CHECK (payment_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS payment_amount      NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS target_date         DATE;
