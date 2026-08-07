-- Fix: Ensure the account-manager role has 'delete' permission on 'accounts'.
-- Migration 046 intended this, but ON CONFLICT DO NOTHING ignored it if the
-- matrix cells were previously seeded or the lock logic prevented update.

UPDATE role_permissions
SET is_allowed = TRUE, updated_at = NOW()
FROM roles r
WHERE role_permissions.role_id = r.id
  AND r.key = 'account-manager'
  AND role_permissions.module_key = 'accounts'
  AND role_permissions.permission_key = 'delete';
