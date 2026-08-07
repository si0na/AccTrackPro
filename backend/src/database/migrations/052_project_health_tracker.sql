CREATE TABLE project_health_updates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  health TEXT NOT NULL CHECK (health IN ('Green','Amber','Red')),
  status_summary TEXT NOT NULL,
  key_achievements TEXT NOT NULL DEFAULT '',
  current_challenges TEXT NOT NULL DEFAULT '',
  risks_impacting_health TEXT NOT NULL DEFAULT '',
  mitigation_plan TEXT NOT NULL DEFAULT '',
  support_required TEXT NOT NULL DEFAULT '',
  next_review_date DATE,
  overall_confidence_pct NUMERIC(5,2) CHECK (overall_confidence_pct BETWEEN 0 AND 100),
  reviewed_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_phu_project ON project_health_updates(project_id);
