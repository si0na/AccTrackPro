-- Migration 075: Project Progress History & Validation
-- Tracks historical progress updates for projects (as_on_date, completion %, effort, cost, notes).

CREATE TABLE project_progress_updates (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id              TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  as_on_date              DATE NOT NULL,
  planned_completion_pct  NUMERIC(5,2) CHECK (planned_completion_pct BETWEEN 0 AND 100),
  actual_completion_pct   NUMERIC(5,2) CHECK (actual_completion_pct BETWEEN 0 AND 100),
  planned_effort_hours    NUMERIC(10,2) CHECK (planned_effort_hours >= 0),
  actual_effort_hours     NUMERIC(10,2) CHECK (actual_effort_hours >= 0),
  planned_cost            NUMERIC(15,2) CHECK (planned_cost >= 0),
  actual_cost             NUMERIC(15,2) CHECK (actual_cost >= 0),
  notes                   TEXT NOT NULL DEFAULT '',
  updated_by_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  edited_by_id            TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at               TIMESTAMPTZ
);

CREATE INDEX idx_ppu_project ON project_progress_updates(project_id);
CREATE INDEX idx_ppu_project_as_on_date ON project_progress_updates(project_id, as_on_date DESC, created_at DESC);

-- Seed initial progress history records from existing projects table
INSERT INTO project_progress_updates (
  project_id,
  as_on_date,
  planned_completion_pct,
  actual_completion_pct,
  planned_effort_hours,
  actual_effort_hours,
  planned_cost,
  actual_cost,
  updated_by_id,
  created_at
)
SELECT
  id,
  COALESCE(as_on_date, CURRENT_DATE),
  planned_completion_pct,
  actual_completion_pct,
  planned_effort_hours,
  actual_effort_hours,
  planned_cost,
  actual_cost,
  owner_id,
  created_at
FROM projects
WHERE is_deleted = FALSE AND (
  as_on_date IS NOT NULL OR
  planned_completion_pct IS NOT NULL OR
  actual_completion_pct IS NOT NULL OR
  planned_effort_hours IS NOT NULL OR
  actual_effort_hours IS NOT NULL OR
  planned_cost IS NOT NULL OR
  actual_cost IS NOT NULL
);
