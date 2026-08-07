-- Grant the account-manager role 'delete' on Opportunities and Stakeholders.
--
-- Migration 046 seeded account-manager with create/update/view-all on both
-- modules but never 'delete', so the matrix cells were inserted as
-- is_allowed = FALSE. Both the frontend (`can('opportunities','delete')`,
-- `can('stakeholders','delete')`) and the backend @RequirePermission guard read
-- those cells, so the delete action was hidden in the UI and rejected by the API.
--
-- Neither cell is locked (only Accounts→Delete is), so an admin can still toggle
-- these off later from Role & Permission Management.

INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, m.key, 'delete', TRUE, FALSE
  FROM roles r
 CROSS JOIN (VALUES ('opportunities'), ('stakeholders')) AS m(key)
 WHERE r.key = 'account-manager'
ON CONFLICT (role_id, module_key, permission_key)
DO UPDATE SET is_allowed = TRUE, updated_at = NOW();
