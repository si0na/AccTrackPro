-- Store the active calendar snapshot on each financial year row so that
-- historical quarter calculations never change when the global calendar changes.

ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS calendar_start_month INTEGER NOT NULL DEFAULT 4;
ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS calendar_quarters    JSONB   NOT NULL DEFAULT '[{"label":"Q1","startMonth":4,"endMonth":6},{"label":"Q2","startMonth":7,"endMonth":9},{"label":"Q3","startMonth":10,"endMonth":12},{"label":"Q4","startMonth":1,"endMonth":3}]';

-- Clean up obsolete one-time-run markers from the legacy migration system.
DELETE FROM administration_settings
 WHERE key IN ('fy_global_period_migration_v1', 'fy_ai_stk_migration_v1');
