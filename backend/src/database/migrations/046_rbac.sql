-- Enterprise Role-Based Access Control (RBAC)
--
-- Introduces a database-driven permission model so administrators can manage
-- Roles and per-module CRUD permissions entirely from the UI — no code changes
-- needed to alter authorization behaviour.
--
-- Tables:
--   roles             — configurable roles (seeded with 7 system roles).
--   modules           — the application areas that permissions apply to.
--   permissions       — the permission verbs (create/view/update/delete/...).
--   role_permissions  — the matrix: one cell per (role, module, permission)
--                       with is_allowed (configurable) and is_locked (business
--                       rule — never editable, e.g. Accounts→Delete).
--
-- Column additions:
--   users / employee_master — role_id FK + employee_id / department / designation.
--   accounts                — four ownership FKs (account_manager_id, practice_lead_id,
--                             client_partner_id, vertical_head_id) driving role-based
--                             account visibility.

-- ── Roles ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  key                 TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT,
  -- The accounts FK column this role is scoped by for visibility. NULL means
  -- the role is not ownership-scoped (visibility governed by the view-all perm).
  account_scope_field TEXT,
  is_system           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Modules (application areas) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modules (
  key        TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0
);

-- ── Permissions (verbs) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  key        TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0
);

-- ── Role × Module × Permission matrix ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_key    TEXT NOT NULL REFERENCES modules(key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  is_allowed    BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, module_key, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_perm_role ON role_permissions(role_id);

-- ── users / employee_master attribute columns ──────────────────────────────────
ALTER TABLE users           ADD COLUMN IF NOT EXISTS role_id     TEXT;
ALTER TABLE users           ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE users           ADD COLUMN IF NOT EXISTS department  TEXT;
ALTER TABLE users           ADD COLUMN IF NOT EXISTS designation TEXT;

ALTER TABLE employee_master ADD COLUMN IF NOT EXISTS role_id     TEXT;
ALTER TABLE employee_master ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE employee_master ADD COLUMN IF NOT EXISTS department  TEXT;
ALTER TABLE employee_master ADD COLUMN IF NOT EXISTS designation TEXT;

-- ── accounts ownership FK columns ───────────────────────────────────────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_manager_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS practice_lead_id   TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS client_partner_id  TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vertical_head_id   TEXT;

CREATE INDEX IF NOT EXISTS idx_acc_account_manager ON accounts(account_manager_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_acc_practice_lead   ON accounts(practice_lead_id)   WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_acc_client_partner  ON accounts(client_partner_id)  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_acc_vertical_head   ON accounts(vertical_head_id)   WHERE is_deleted = FALSE;

-- ── Foreign keys (idempotent) ───────────────────────────────────────────────────
DO $rbac_fk$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_role') THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_role
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_employee_master_role') THEN
    ALTER TABLE employee_master ADD CONSTRAINT fk_employee_master_role
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounts_account_manager') THEN
    ALTER TABLE accounts ADD CONSTRAINT fk_accounts_account_manager
      FOREIGN KEY (account_manager_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounts_practice_lead') THEN
    ALTER TABLE accounts ADD CONSTRAINT fk_accounts_practice_lead
      FOREIGN KEY (practice_lead_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounts_client_partner') THEN
    ALTER TABLE accounts ADD CONSTRAINT fk_accounts_client_partner
      FOREIGN KEY (client_partner_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounts_vertical_head') THEN
    ALTER TABLE accounts ADD CONSTRAINT fk_accounts_vertical_head
      FOREIGN KEY (vertical_head_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $rbac_fk$;

-- ── Seed: roles ─────────────────────────────────────────────────────────────────
-- account_scope_field drives ownership-based visibility. admin/sales/finance are
-- NULL (they see accounts via the view-all permission, not by ownership).
INSERT INTO roles (key, name, description, account_scope_field, is_system) VALUES
  ('admin',          'Admin',           'Full system administration and configuration.',        NULL,                 TRUE),
  ('vertical-head',  'Vertical Head',   'Owns accounts where they are the Vertical Head.',       'vertical_head_id',   TRUE),
  ('account-manager','Account Manager', 'Owns accounts where they are the Account Manager.',     'account_manager_id', TRUE),
  ('practice-lead',  'Practice Lead',   'Owns accounts where they are the Practice Lead.',       'practice_lead_id',   TRUE),
  ('client-partner', 'Client Partner',  'Owns accounts where they are the Client Partner.',      'client_partner_id',  TRUE),
  ('sales',          'Sales',           'Views all accounts; never permitted to delete them.',  NULL,                 TRUE),
  ('finance',        'Finance',         'Access governed by configured permissions.',           NULL,                 TRUE)
ON CONFLICT (key) DO NOTHING;

-- ── Seed: modules ───────────────────────────────────────────────────────────────
INSERT INTO modules (key, name, sort_order) VALUES
  ('dashboard',      'Dashboard',        0),
  ('accounts',       'Accounts',         1),
  ('opportunities',  'Opportunities',    2),
  ('action-items',   'Action Items',     3),
  ('stakeholders',   'Stakeholders',     4),
  ('projects',       'Projects',         5),
  ('forecast',       'Forecast',         6),
  ('reports',        'Reports',          7),
  ('performance',    'Performance',      8),
  ('import-export',  'Import / Export',  9),
  ('administration', 'Administration',  10)
ON CONFLICT (key) DO NOTHING;

-- ── Seed: permissions ───────────────────────────────────────────────────────────
INSERT INTO permissions (key, name, sort_order) VALUES
  ('view',     'View',      0),
  ('view-all', 'View All',  1),
  ('create',   'Create',    2),
  ('update',   'Update',    3),
  ('delete',   'Delete',    4),
  ('import',   'Import',    5),
  ('export',   'Export',    6),
  ('approve',  'Approve',   7),
  ('assign',   'Assign',    8),
  ('manage',   'Manage',    9)
ON CONFLICT (key) DO NOTHING;

-- ── Seed: role_permissions matrix (default values only — admins may change them) ──
-- Generated by cross-joining every role × module × permission and computing the
-- default is_allowed / is_locked. ON CONFLICT DO NOTHING preserves admin edits on
-- re-runs. Business rule: Accounts→Delete is permanently locked for every role
-- (allowed only for admin and account-manager, and can never be toggled).
INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, m.key, p.key,
  CASE
    -- Admin: full access everywhere.
    WHEN r.key = 'admin' THEN TRUE

    -- Dashboard: visible to everyone.
    WHEN m.key = 'dashboard' AND p.key = 'view' THEN TRUE

    -- Accounts (spec-driven defaults):
    WHEN m.key = 'accounts' AND p.key = 'view' THEN TRUE
    WHEN m.key = 'accounts' AND p.key = 'view-all' AND r.key IN ('sales','finance') THEN TRUE
    WHEN m.key = 'accounts' AND p.key IN ('create','update') AND r.key = 'account-manager' THEN TRUE
    WHEN m.key = 'accounts' AND p.key = 'delete'  AND r.key = 'account-manager' THEN TRUE
    WHEN m.key = 'accounts' AND p.key IN ('import','export') AND r.key = 'account-manager' THEN TRUE

    -- Opportunities: everyone views; account-manager & sales work them.
    WHEN m.key = 'opportunities' AND p.key = 'view' THEN TRUE
    WHEN m.key = 'opportunities' AND p.key IN ('create','update','view-all','export')
         AND r.key IN ('account-manager','sales') THEN TRUE

    -- Action items / stakeholders: everyone views; account-manager edits.
    WHEN m.key IN ('action-items','stakeholders') AND p.key = 'view' THEN TRUE
    WHEN m.key IN ('action-items','stakeholders') AND p.key IN ('create','update','view-all')
         AND r.key = 'account-manager' THEN TRUE

    -- Reports / forecast: viewable by managers, finance and sales; export for
    -- account-manager and finance.
    WHEN m.key IN ('reports','forecast') AND p.key = 'view'
         AND r.key IN ('account-manager','vertical-head','practice-lead','client-partner','finance','sales') THEN TRUE
    WHEN m.key IN ('reports','forecast') AND p.key = 'export'
         AND r.key IN ('account-manager','finance') THEN TRUE

    -- Projects / performance: viewable by managers; account-manager edits.
    WHEN m.key IN ('projects','performance') AND p.key = 'view'
         AND r.key IN ('account-manager','vertical-head','practice-lead','client-partner') THEN TRUE
    WHEN m.key IN ('projects','performance') AND p.key IN ('create','update')
         AND r.key = 'account-manager' THEN TRUE

    -- Import / Export module: account-manager only by default.
    WHEN m.key = 'import-export' AND p.key IN ('view','import','export')
         AND r.key = 'account-manager' THEN TRUE

    -- Administration: admin only (covered above); everyone else denied.
    ELSE FALSE
  END AS is_allowed,
  -- Lock rule: Accounts→Delete is a permanent business rule for every role.
  CASE WHEN m.key = 'accounts' AND p.key = 'delete' THEN TRUE ELSE FALSE END AS is_locked
FROM roles r
CROSS JOIN modules m
CROSS JOIN permissions p
ON CONFLICT (role_id, module_key, permission_key) DO NOTHING;

-- ── Backfill existing data ──────────────────────────────────────────────────────
-- Every existing user currently defaults to the 'Account Manager' role — map them
-- to the account-manager role so nobody is locked out. Rows already carrying a
-- role_id are left untouched.
UPDATE users u
   SET role_id = r.id
  FROM roles r
 WHERE u.role_id IS NULL
   AND r.key = LOWER(REPLACE(COALESCE(NULLIF(TRIM(u.role), ''), 'Account Manager'), ' ', '-'));

-- Fallback for any user whose free-text role did not map to a known role key.
UPDATE users u
   SET role_id = r.id
  FROM roles r
 WHERE u.role_id IS NULL
   AND r.key = 'account-manager';

-- Existing accounts: their current owner keeps visibility by seeding the
-- account_manager_id from owner_id (owners today are Account Managers).
UPDATE accounts
   SET account_manager_id = owner_id
 WHERE account_manager_id IS NULL
   AND owner_id IS NOT NULL;

-- Give the seeded admin employee (siona.thomas@) the admin role so an admin can
-- reach Role & Permission Management after registering.
UPDATE employee_master e
   SET role_id = r.id
  FROM roles r
 WHERE r.key = 'admin'
   AND e.role_id IS NULL
   AND LOWER(e.email) = 'siona.thomas@reflectionsinfos.com';
