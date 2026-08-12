-- Migration 062: Seed the Project Manager system role.
--
-- Creates the 'project-manager' role (is_system = TRUE) so it appears in
-- Administration → System Users → Roles and can be assigned to users through
-- the existing role-management UI.
--
-- Idempotent: ON CONFLICT DO NOTHING on every INSERT means re-running the
-- migration has no side-effect.

-- ── 1. Seed the role ────────────────────────────────────────────────────────
INSERT INTO roles (key, name, description, account_scope_field, is_system)
VALUES (
  'project-manager',
  'Project Manager',
  'Manages assigned opportunities and projects',
  NULL,
  TRUE
)
ON CONFLICT (key) DO NOTHING;

-- ── 2. Materialise the full permission matrix row set for this new role ──────
-- Every (module, permission) combination is inserted as denied / unlocked so
-- the role appears fully in the admin Roles & Permissions grid. Admins can
-- then toggle individual cells without needing another migration.
INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, m.key, p.key, FALSE, FALSE
FROM   roles r
CROSS  JOIN modules m
CROSS  JOIN permissions p
WHERE  r.key = 'project-manager'
ON CONFLICT (role_id, module_key, permission_key) DO NOTHING;

-- ── 3. Grant sensible default permissions for the role ───────────────────────
-- Opportunities: view (own-scoped), view-all, update
-- Action Items : view, create, update
-- Projects     : view, create, update
-- Stakeholders : view
-- Dashboard    : view
UPDATE role_permissions rp
SET    is_allowed = TRUE
FROM   roles r
WHERE  r.key          = 'project-manager'
  AND  rp.role_id     = r.id
  AND  (
    (rp.module_key = 'dashboard'     AND rp.permission_key = 'view')
 OR (rp.module_key = 'opportunities' AND rp.permission_key IN ('view', 'view-all', 'update'))
 OR (rp.module_key = 'action-items'  AND rp.permission_key IN ('view', 'view-all', 'create', 'update'))
 OR (rp.module_key = 'projects'      AND rp.permission_key IN ('view', 'view-all', 'create', 'update'))
 OR (rp.module_key = 'stakeholders'  AND rp.permission_key = 'view')
  );
