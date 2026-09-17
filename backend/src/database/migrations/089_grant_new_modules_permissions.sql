-- Migration 089: Ensure permissions for new modules (Employee Appreciation, Employee R&R, Risks)
-- Seed missing matrix entries for all active roles and grant default permissions

INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, m.key, p.key, FALSE, FALSE
FROM roles r
CROSS JOIN (SELECT key FROM modules WHERE key IN ('employeeAppreciation', 'employeeRewardsRecognition', 'risks')) m
CROSS JOIN permissions p
ON CONFLICT (role_id, module_key, permission_key) DO NOTHING;

-- Default grants: view, create, update, delete, view-all, export for these modules across all roles
UPDATE role_permissions
SET is_allowed = TRUE
WHERE module_key IN ('employeeAppreciation', 'employeeRewardsRecognition', 'risks')
  AND permission_key IN ('view', 'view-all', 'create', 'update', 'delete', 'export');
