-- Add financial_calendar configuration table with a default April-start calendar.

CREATE TABLE IF NOT EXISTS financial_calendar (
  id          TEXT        PRIMARY KEY DEFAULT 'default',
  start_month INTEGER     NOT NULL DEFAULT 4,
  quarters    JSONB       NOT NULL DEFAULT '[{"label":"Q1","startMonth":4,"endMonth":6},{"label":"Q2","startMonth":7,"endMonth":9},{"label":"Q3","startMonth":10,"endMonth":12},{"label":"Q4","startMonth":1,"endMonth":3}]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO financial_calendar (id, start_month, quarters)
VALUES (
  'default',
  4,
  '[{"label":"Q1","startMonth":4,"endMonth":6},{"label":"Q2","startMonth":7,"endMonth":9},{"label":"Q3","startMonth":10,"endMonth":12},{"label":"Q4","startMonth":1,"endMonth":3}]'
)
ON CONFLICT (id) DO NOTHING;
