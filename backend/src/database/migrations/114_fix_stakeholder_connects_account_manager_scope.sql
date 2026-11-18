-- Revoke unintended 'view-all' permission on stakeholder-connects from account-manager.
--
-- Migration 113 seeded role_permissions for 'stakeholder-connects' by copying from
-- 'stakeholders', which granted account-manager 'stakeholder-connects:view-all = TRUE'.
-- Because Account Managers have accounts:view-all = FALSE and are ownership-scoped by
-- account_manager_id / owner_id, inheriting view-all bypassed account scoping on
-- Stakeholder Connects read endpoints and allowed cross-account access.
--
-- Preserves admin, sales/finance (via accounts:view-all), and account-manager's
-- view/create/update/delete permissions scoped to their authorized accounts.
--
-- Reversible rollback:
--   INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
--   SELECT r.id, 'stakeholder-connects', 'view-all', TRUE, FALSE
--     FROM roles r WHERE r.key = 'account-manager'
--   ON CONFLICT (role_id, module_key, permission_key)
--   DO UPDATE SET is_allowed = TRUE, updated_at = NOW();

INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, 'stakeholder-connects', 'view-all', FALSE, FALSE
  FROM roles r
 WHERE r.key = 'account-manager'
   AND EXISTS (SELECT 1 FROM modules m WHERE m.key = 'stakeholder-connects')
   AND EXISTS (SELECT 1 FROM permissions p WHERE p.key = 'view-all')
ON CONFLICT (role_id, module_key, permission_key)
DO UPDATE SET is_allowed = FALSE, updated_at = NOW();

