-- Give Performance Evaluations the same dynamic custom-column storage already
-- used by accounts/opportunities/action_items, so the module can reuse the
-- shared Customize Columns architecture instead of its own bespoke UI.

ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS custom_data JSONB NOT NULL DEFAULT '{}'::jsonb;
