-- Remove the blanket lock on accounts:delete so Admins can configure it freely
-- through the permissions matrix. The permission remains allowed for the
-- account-manager role (set by migration 051) but is no longer locked.
UPDATE role_permissions
SET    is_locked = FALSE,
       updated_at = NOW()
WHERE  module_key = 'accounts'
  AND  permission_key = 'delete';
