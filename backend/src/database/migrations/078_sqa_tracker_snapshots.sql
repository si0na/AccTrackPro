-- Migration 078: SQA Tracker Snapshots
-- Stores weekly historical snapshots of complete SQA records.

CREATE TABLE sqa_tracker_snapshots (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  sqa_record_id          TEXT NOT NULL REFERENCES sqa_records(id) ON DELETE CASCADE,
  project_id             TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id             TEXT REFERENCES accounts(id) ON DELETE SET NULL,

  snapshot_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  iso_year               INTEGER NOT NULL,
  week_number            INTEGER NOT NULL,

  importance             TEXT NOT NULL DEFAULT 'Medium',
  delivery_model         TEXT,
  billing_model          TEXT,
  billing_model_override TEXT,
  tower                  TEXT,
  tower_override         TEXT,
  fte                    NUMERIC(8,2),
  fte_override           NUMERIC(8,2),
  revenue                NUMERIC(15,2),
  revenue_override       NUMERIC(15,2),
  pm_name                TEXT,

  wsr_published          BOOLEAN NOT NULL DEFAULT FALSE,
  health_status          TEXT,
  client_escalation      BOOLEAN NOT NULL DEFAULT FALSE,
  current_week_update    TEXT NOT NULL DEFAULT '',
  next_week_plan         TEXT NOT NULL DEFAULT '',
  issues_challenges      TEXT NOT NULL DEFAULT '',
  path_to_green          TEXT NOT NULL DEFAULT '',
  resourcing_status      TEXT,
  current_sdlc_phase     TEXT,
  sqa_remarks            TEXT NOT NULL DEFAULT '',

  updated_by_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_name        TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: exactly one logical snapshot per SQA Record per ISO Year + Week Number
CREATE UNIQUE INDEX uq_sqa_tracker_record_week ON sqa_tracker_snapshots(sqa_record_id, iso_year, week_number);

CREATE INDEX idx_sts_sqa_record ON sqa_tracker_snapshots(sqa_record_id);
CREATE INDEX idx_sts_project ON sqa_tracker_snapshots(project_id);
CREATE INDEX idx_sts_account ON sqa_tracker_snapshots(account_id);
CREATE INDEX idx_sts_date_week ON sqa_tracker_snapshots(snapshot_date DESC, iso_year DESC, week_number DESC);

-- Seed initial snapshots for existing SQA records if any
INSERT INTO sqa_tracker_snapshots (
  sqa_record_id,
  project_id,
  account_id,
  snapshot_date,
  iso_year,
  week_number,
  importance,
  delivery_model,
  billing_model,
  billing_model_override,
  tower,
  tower_override,
  fte,
  fte_override,
  revenue,
  revenue_override,
  pm_name,
  wsr_published,
  health_status,
  client_escalation,
  current_week_update,
  next_week_plan,
  issues_challenges,
  path_to_green,
  resourcing_status,
  current_sdlc_phase,
  sqa_remarks,
  updated_by_id,
  created_at,
  updated_at
)
SELECT
  s.id AS sqa_record_id,
  s.project_id,
  p.account_id,
  CURRENT_DATE,
  EXTRACT(ISOYEAR FROM CURRENT_DATE)::INTEGER,
  EXTRACT(WEEK FROM CURRENT_DATE)::INTEGER,
  s.importance,
  s.delivery_model,
  COALESCE(s.billing_model_override, p.billing_model, o.billing_model),
  s.billing_model_override,
  COALESCE(s.tower_override, p.tower, o.tower, a.tower),
  s.tower_override,
  COALESCE(s.fte_override, (SELECT COUNT(*) FROM project_team_members ptm WHERE ptm.project_id = p.id)::NUMERIC),
  s.fte_override,
  COALESCE(s.revenue_override, p.deal_value, o.value),
  s.revenue_override,
  pm.name AS pm_name,
  s.wsr_published,
  p.health AS health_status,
  s.client_escalation,
  s.current_week_update,
  s.next_week_plan,
  s.issues_challenges,
  s.path_to_green,
  s.resourcing_status,
  s.current_sdlc_phase,
  s.sqa_remarks,
  s.owner_id,
  s.created_at,
  NOW()
FROM sqa_records s
INNER JOIN projects p ON s.project_id = p.id AND p.is_deleted = FALSE
LEFT JOIN accounts a ON p.account_id = a.id
LEFT JOIN opportunities o ON p.opportunity_id = o.id
LEFT JOIN users pm ON p.service_provider_pm_id = pm.id
WHERE s.is_deleted = FALSE
ON CONFLICT (sqa_record_id, iso_year, week_number) DO NOTHING;
