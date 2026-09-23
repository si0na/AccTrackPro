-- Migration 106: Add Project Action Items module and grant initial role permissions.

-- 1. Insert module into modules table
INSERT INTO modules (key, name, sort_order)
VALUES ('project-action-items', 'Project Action Items', 4)
ON CONFLICT (key) DO NOTHING;

-- 2. Materialize permission matrix cells (role_permissions) for all roles
INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, m.key, p.key, FALSE, FALSE
FROM roles r
CROSS JOIN (SELECT key FROM modules WHERE key = 'project-action-items') m
CROSS JOIN (SELECT key FROM permissions WHERE key IN ('view', 'view-all', 'create', 'update', 'delete')) p
ON CONFLICT (role_id, module_key, permission_key) DO NOTHING;

-- 3. Grant default permissions to admin role (full access)
UPDATE role_permissions rp
SET is_allowed = TRUE
FROM roles r
WHERE r.key = 'admin'
  AND rp.role_id = r.id
  AND rp.module_key = 'project-action-items'
  AND rp.permission_key IN ('view', 'view-all', 'create', 'update', 'delete');

-- 4. Grant default permissions to project-manager role: View, Create, Update, Delete (View-All remains FALSE)
UPDATE role_permissions rp
SET is_allowed = TRUE
FROM roles r
WHERE r.key = 'project-manager'
  AND rp.role_id = r.id
  AND rp.module_key = 'project-action-items'
  AND rp.permission_key IN ('view', 'create', 'update', 'delete');
