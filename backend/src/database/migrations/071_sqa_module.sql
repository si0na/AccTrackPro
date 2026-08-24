-- Migration 071: SQA (Software Quality Assurance) module
--
-- SQA provides project-level weekly quality tracking and reporting. It owns
-- ONLY the fields nobody else does: the SQA classification, the weekly
-- narrative, and the SQA remarks. Everything the application already knows —
-- Account, Project, PM, Revenue, Billing Model, Tower, team size — is READ
-- THROUGH the project relationship at query time, never copied into this table.
--
-- Where an existing source exists but SQA legitimately needs to disagree with
-- it, the column is a nullable *override*: NULL means "inherit from the
-- Project / Opportunity", a value means "SQA states otherwise". Inheritance
-- map (see sqa.service.ts):
--
--   Account        → projects.account_id                    (never stored here)
--   Project        → sqa_records.project_id                 (the primary link)
--   PM             → projects.service_provider_pm_id        (never stored here)
--   Revenue        → projects.deal_value → opportunities.value    + override
--   Billing Model  → opportunities.revenue_model                  + override
--   Tower          → opportunities.service_line                   + override
--   FTE            → COUNT(project_team_members)                  + override
--   Delivery Model → no existing source anywhere; SQA-maintained
--
-- Weekly health (Health Week 31/32/33/…) is NOT stored here either: it is
-- derived from — and written back into — the existing project_health_updates
-- audit trail, bucketed by ISO week. SQA adds no second health system.

CREATE TABLE sqa_records (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  -- The primary (and only) relationship: Account/PM/Revenue/Tower all hang off it.
  project_id             TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id               TEXT REFERENCES users(id) ON DELETE SET NULL,

  -- ── SQA classification ────────────────────────────────────────────────────
  importance             TEXT NOT NULL DEFAULT 'Medium' CHECK (importance IN ('High','Medium','Low')),

  -- ── Delivery attributes ───────────────────────────────────────────────────
  -- delivery_model has no existing source in the application, so SQA owns it
  -- outright. The other three are overrides over inherited values.
  -- No CHECK constraints on these four: their master lists live in
  -- common/utils/sqa-options.util.ts (the same pattern as opportunities'
  -- service_line) so a list can grow without a schema migration.
  delivery_model         TEXT,
  billing_model_override TEXT,
  tower_override         TEXT,
  fte_override           NUMERIC(8,2) CHECK (fte_override IS NULL OR fte_override >= 0),
  revenue_override       NUMERIC(15,2) CHECK (revenue_override IS NULL OR revenue_override >= 0),

  -- ── SQA-specific weekly tracking ──────────────────────────────────────────
  wsr_published          BOOLEAN NOT NULL DEFAULT FALSE,  -- "WSR Publish Status (Y/N)"
  client_escalation      BOOLEAN NOT NULL DEFAULT FALSE,
  current_week_update    TEXT NOT NULL DEFAULT '',
  next_week_plan         TEXT NOT NULL DEFAULT '',
  issues_challenges      TEXT NOT NULL DEFAULT '',
  path_to_green          TEXT NOT NULL DEFAULT '',
  resourcing_status      TEXT,
  current_sdlc_phase     TEXT,
  sqa_remarks            TEXT NOT NULL DEFAULT '',

  custom_data            JSONB NOT NULL DEFAULT '{}',
  is_deleted             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active SQA record per project — the weekly narrative is the project's,
-- so a second record for the same project would be a duplicate, not a variant.
CREATE UNIQUE INDEX uq_sqa_project ON sqa_records(project_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_sqa_owner ON sqa_records(owner_id) WHERE is_deleted = FALSE;

-- Weekly health is read out of project_health_updates by ISO-week bucket on
-- every SQA list render; this index keeps that scan cheap.
CREATE INDEX IF NOT EXISTS idx_phu_project_created
  ON project_health_updates(project_id, created_at DESC);

-- ── RBAC: register SQA as a permissionable module ────────────────────────────
-- SQA sits with Projects under Delivery, so it takes sort_order 6 and the
-- later modules shift down one. The admin matrix and the SPA nav both read
-- these rows, so no code change is needed to expose the module.
UPDATE modules SET sort_order = 7  WHERE key = 'forecast';
UPDATE modules SET sort_order = 8  WHERE key = 'reports';
UPDATE modules SET sort_order = 9  WHERE key = 'performance';
UPDATE modules SET sort_order = 10 WHERE key = 'import-export';
UPDATE modules SET sort_order = 11 WHERE key = 'administration';

INSERT INTO modules (key, name, sort_order) VALUES ('sqa', 'SQA', 6)
ON CONFLICT (key) DO NOTHING;

-- Materialise the full matrix row set for the new module across every existing
-- role (denied / unlocked) so it appears complete in the admin grid.
INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, 'sqa', p.key, FALSE, FALSE
FROM   roles r CROSS JOIN permissions p
ON CONFLICT (role_id, module_key, permission_key) DO NOTHING;

-- Defaults, mirroring the Projects module's grants plus the Project Manager
-- role (SQA is a delivery-side workflow): admins get everything, delivery
-- roles view, account managers and project managers maintain records.
UPDATE role_permissions rp
SET    is_allowed = TRUE
FROM   roles r
WHERE  rp.role_id = r.id
  AND  rp.module_key = 'sqa'
  AND  (
       r.key = 'admin'
    OR (rp.permission_key = 'view'
        AND r.key IN ('account-manager','project-manager','practice-lead','vertical-head','client-partner'))
    OR (rp.permission_key IN ('view-all','create','update','export')
        AND r.key IN ('account-manager','project-manager'))
    OR (rp.permission_key = 'delete' AND r.key = 'account-manager')
  );
