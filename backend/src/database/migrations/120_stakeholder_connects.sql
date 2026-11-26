-- Migration 113: Stakeholder Connect Module (Phase 1)
-- Introduces core meeting management, attendees junction, draft follow-ups,
-- linked action items, and reschedule history tables with RBAC permission integration.

-- ── 1. RBAC Module & Permissions ───────────────────────────────────────────
INSERT INTO modules (key, name, sort_order)
VALUES ('stakeholder-connects', 'Stakeholder Connects', 15)
ON CONFLICT (key) DO NOTHING;

-- Materialize permission matrix cells for all active roles (defaulting to denied and unlocked)
INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, 'stakeholder-connects', p.key, FALSE, FALSE
FROM roles r
CROSS JOIN permissions p
WHERE p.key IN ('view', 'view-all', 'create', 'update', 'delete', 'export')
ON CONFLICT (role_id, module_key, permission_key) DO NOTHING;

-- Seed initial permissions by copying active grants from 'stakeholders' independently by verb
UPDATE role_permissions target
SET is_allowed = source.is_allowed,
    is_locked  = FALSE,
    updated_at = NOW()
FROM role_permissions source
WHERE source.module_key = 'stakeholders'
  AND source.role_id = target.role_id
  AND source.permission_key = target.permission_key
  AND target.module_key = 'stakeholder-connects'
  AND target.permission_key IN ('view', 'view-all', 'create', 'update', 'delete', 'export');

-- ── 2. Primary Meeting Record ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stakeholder_connects (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id          TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  owner_id            TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title               VARCHAR(255) NOT NULL,
  meeting_date        DATE NOT NULL,
  meeting_time        TIME WITHOUT TIME ZONE NOT NULL,
  status              VARCHAR(50) NOT NULL DEFAULT 'Scheduled' 
                      CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'Rescheduled')),
  mom_notes           TEXT,
  cancellation_reason TEXT,
  is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
  created_by          TEXT NOT NULL REFERENCES users(id),
  updated_by          TEXT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stk_conn_account ON stakeholder_connects(account_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_stk_conn_date    ON stakeholder_connects(meeting_date);
CREATE INDEX IF NOT EXISTS idx_stk_conn_status  ON stakeholder_connects(status);
CREATE INDEX IF NOT EXISTS idx_stk_conn_owner   ON stakeholder_connects(owner_id);

-- ── 3. Attendees Junction ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stakeholder_connect_attendees (
  connect_id      TEXT NOT NULL REFERENCES stakeholder_connects(id) ON DELETE CASCADE,
  stakeholder_id  TEXT NOT NULL REFERENCES stakeholders(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (connect_id, stakeholder_id)
);

CREATE INDEX IF NOT EXISTS idx_stk_conn_att_stk ON stakeholder_connect_attendees(stakeholder_id);

-- ── 4. Draft Follow-Ups (Single Source of Truth: converted_at IS NOT NULL) ──
CREATE TABLE IF NOT EXISTS stakeholder_connect_draft_follow_ups (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  connect_id               TEXT NOT NULL REFERENCES stakeholder_connects(id) ON DELETE CASCADE,
  title                    VARCHAR(255) NOT NULL,
  description              TEXT,
  suggested_owner_id       TEXT REFERENCES stakeholders(id) ON DELETE SET NULL,
  converted_at             TIMESTAMPTZ,
  converted_action_item_id TEXT UNIQUE REFERENCES action_items(id) ON DELETE SET NULL,
  created_by               TEXT NOT NULL REFERENCES users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stk_conn_drafts_conn ON stakeholder_connect_draft_follow_ups(connect_id);

-- ── 5. Action Item Links Junction ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stakeholder_connect_action_items (
  connect_id     TEXT NOT NULL REFERENCES stakeholder_connects(id) ON DELETE CASCADE,
  action_item_id TEXT NOT NULL REFERENCES action_items(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (connect_id, action_item_id)
);

CREATE INDEX IF NOT EXISTS idx_stk_conn_ai_item ON stakeholder_connect_action_items(action_item_id);

-- ── 6. Reschedule History Audit ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stakeholder_connect_reschedule_history (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  connect_id     TEXT NOT NULL REFERENCES stakeholder_connects(id) ON DELETE RESTRICT,
  old_date       DATE NOT NULL,
  old_time       TIME WITHOUT TIME ZONE,
  new_date       DATE NOT NULL,
  new_time       TIME WITHOUT TIME ZONE,
  reason         TEXT,
  rescheduled_by TEXT NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stk_conn_resched_conn ON stakeholder_connect_reschedule_history(connect_id);
