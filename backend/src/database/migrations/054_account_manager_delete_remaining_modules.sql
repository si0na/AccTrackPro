-- Extend the account-manager role's 'delete' grant to the remaining business
-- modules it is expected to manage: Action Items, Projects and Performance.
--
-- Continues the fix started in 053 (Opportunities, Stakeholders). Migration 046
-- seeded account-manager with create/update on these modules but never 'delete',
-- so the matrix cells exist as is_allowed = FALSE.
--
-- Import/Export is deliberately excluded: that module exposes no delete
-- operation (validate / import / export-log / audit only), so a Delete grant
-- there would be a permission with nothing behind it. Add it here if a delete
-- endpoint is ever introduced.
--
-- None of these cells are locked (only Accounts->Delete is), so administrators
-- can still toggle them from Role & Permission Management.

INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, m.key, 'delete', TRUE, FALSE
  FROM roles r
 CROSS JOIN (VALUES ('action-items'), ('projects'), ('performance')) AS m(key)
 WHERE r.key = 'account-manager'
ON CONFLICT (role_id, module_key, permission_key)
DO UPDATE SET is_allowed = TRUE, updated_at = NOW();
