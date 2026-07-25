-- Project Management module: Won opportunities transition into a Project
-- record (Overview/Progress/Milestones/Risks/Assumptions/Issues/Dependencies/
-- Action Items/Team). The Opportunity stays in the database as read-only sales
-- history; the Project becomes the live, working record.

CREATE TABLE projects (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name                        TEXT NOT NULL,
  description                 TEXT NOT NULL DEFAULT '',
  account_id                  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  opportunity_id              TEXT NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT, -- originating Opportunity; RESTRICT so the source can't vanish out from under a live project
  owner_id                    TEXT REFERENCES users(id) ON DELETE SET NULL,               -- ownership scoping, seeded from opportunity.owner_id
  start_date                  DATE,
  end_date                    DATE,
  methodology                 TEXT NOT NULL DEFAULT 'Agile' CHECK (methodology IN ('Agile','Waterfall')),
  service_provider_pm_id       TEXT REFERENCES users(id) ON DELETE SET NULL,               -- Service Provider Project Manager
  practice_lead_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  client_stakeholder_id        TEXT REFERENCES stakeholders(id) ON DELETE SET NULL,        -- "Client Name" contact
  client_pm_stakeholder_id     TEXT REFERENCES stakeholders(id) ON DELETE SET NULL,        -- Client Project Manager
  status                      TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','On Hold','Completed','Cancelled')),
  health                      TEXT NOT NULL DEFAULT 'Green' CHECK (health IN ('Green','Amber','Red')),
  as_on_date                  DATE,
  planned_completion_pct      NUMERIC(5,2) CHECK (planned_completion_pct BETWEEN 0 AND 100),
  actual_completion_pct       NUMERIC(5,2) CHECK (actual_completion_pct BETWEEN 0 AND 100),
  planned_effort_hours        NUMERIC(10,2),
  actual_effort_hours         NUMERIC(10,2),
  planned_cost                NUMERIC(15,2),
  actual_cost                 NUMERIC(15,2),
  custom_data                 JSONB NOT NULL DEFAULT '{}',
  is_deleted                  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_project_opportunity ON projects(opportunity_id) WHERE is_deleted = FALSE; -- one project per opportunity
CREATE INDEX idx_project_account  ON projects(account_id)  WHERE is_deleted = FALSE;
CREATE INDEX idx_project_owner    ON projects(owner_id)    WHERE is_deleted = FALSE;

CREATE TABLE project_milestones (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sprints TEXT,                          -- free text, e.g. "Sprint 3-4"
  planned_start DATE, planned_end DATE, actual_start DATE, actual_end DATE,
  status TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Completed','Delayed')),
  remarks TEXT NOT NULL DEFAULT '',
  effort_planned NUMERIC(10,2), effort_spent NUMERIC(10,2),
  cost_planned NUMERIC(15,2), cost_spent NUMERIC(15,2),
  completion_pct NUMERIC(5,2) CHECK (completion_pct BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pm_project ON project_milestones(project_id);

-- project_risks / project_assumptions / project_issues / project_dependencies:
-- share: id, project_id FK CASCADE, priority TEXT CHECK IN ('High','Medium','Low'),
--        description TEXT, owner_id TEXT REFERENCES users(id), status TEXT,
--        target_resolution_date/target_validation_date DATE, remarks TEXT,
--        created_at/updated_at. Distinct columns per table:
CREATE TABLE project_risks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('High','Medium','Low')),
  description TEXT NOT NULL,
  impact TEXT, likelihood TEXT, severity TEXT,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  mitigation_plan TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Mitigated','Closed','Accepted')),
  target_resolution_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pr_project ON project_risks(project_id);

CREATE TABLE project_assumptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('High','Medium','Low')),
  description TEXT NOT NULL,
  impact_if_false TEXT,
  validation_status TEXT NOT NULL DEFAULT 'Unvalidated' CHECK (validation_status IN ('Unvalidated','Validated','Invalidated')),
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  date_identified DATE, target_validation_date DATE, remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pa_project ON project_assumptions(project_id);

CREATE TABLE project_issues (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('High','Medium','Low')),
  description TEXT NOT NULL, impact TEXT,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  date_identified DATE,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Resolved','Closed')),
  resolution_plan TEXT NOT NULL DEFAULT '', target_resolution_date DATE, remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pi_project ON project_issues(project_id);

CREATE TABLE project_dependencies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('High','Medium','Low')),
  description TEXT NOT NULL,
  dependency_type TEXT, dependent_task TEXT,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  external_party TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Resolved','Closed')),
  target_resolution_date DATE, remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pd_project ON project_dependencies(project_id);

CREATE TABLE project_team_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seniority_level TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ptm_project ON project_team_members(project_id);

-- Reuse Action Items instead of a new table:
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ai_project ON action_items(project_id) WHERE is_deleted = FALSE;
