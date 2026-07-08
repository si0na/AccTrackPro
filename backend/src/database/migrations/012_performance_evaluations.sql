-- Performance Evaluations module
CREATE TABLE IF NOT EXISTS performance_evaluations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,

  -- Context
  account        TEXT NOT NULL,
  project        TEXT NOT NULL,
  employee_name  TEXT NOT NULL,
  manager        TEXT NOT NULL,
  month          TEXT NOT NULL,
  has_reportees  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Numerical scores (0–10)
  delivery_excellence   NUMERIC(4,2) NOT NULL DEFAULT 8,
  quality_standards     NUMERIC(4,2) NOT NULL DEFAULT 8,
  technical_capability  NUMERIC(4,2) NOT NULL DEFAULT 8,
  communication         NUMERIC(4,2) NOT NULL DEFAULT 8,
  sla                   NUMERIC(4,2) NOT NULL DEFAULT 8,
  team_collaboration    NUMERIC(4,2) NOT NULL DEFAULT 8,
  reliability           NUMERIC(4,2) NOT NULL DEFAULT 8,
  innovation            NUMERIC(4,2) NOT NULL DEFAULT 8,
  ideation              NUMERIC(4,2) NOT NULL DEFAULT 8,
  behavioural           NUMERIC(4,2) NOT NULL DEFAULT 8,
  leadership            NUMERIC(4,2),          -- NULL when has_reportees = FALSE

  -- Qualitative fields
  customer_feedback         TEXT NOT NULL DEFAULT '',
  employee_feedback         TEXT NOT NULL DEFAULT '',
  training_required         TEXT NOT NULL DEFAULT '',
  strength                  TEXT NOT NULL DEFAULT '',
  improvement_area          TEXT NOT NULL DEFAULT '',
  key_contribution_details  TEXT NOT NULL DEFAULT '',
  idea_details              TEXT NOT NULL DEFAULT '',
  overall_comment           TEXT NOT NULL DEFAULT '',
  action_item_next_month    TEXT NOT NULL DEFAULT '',
  retention_risk            TEXT NOT NULL DEFAULT 'Low'
    CHECK (retention_risk IN ('High', 'Medium', 'Low')),

  -- Ownership / lifecycle
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pe_created_by ON performance_evaluations(created_by);
CREATE INDEX IF NOT EXISTS idx_pe_employee   ON performance_evaluations(employee_name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_pe_month      ON performance_evaluations(month)         WHERE is_deleted = FALSE;
