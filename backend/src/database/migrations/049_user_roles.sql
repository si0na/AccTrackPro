-- Multi-role support.
--
-- Until now a user held exactly one role (users.role_id). The business needs a
-- user to hold several simultaneously — e.g. Siona is both an Admin (full
-- administration) and an Account Manager (auto AM assignment, Service Provider
-- registration, account ownership, AM-scoped permissions).
--
-- Model:
--   • user_roles          — the authoritative set of roles a user holds (N:N).
--   • users.role_id        — retained as the "primary" role: the JWT display
--                            claim and the default single-role fallback. It is
--                            always also present as a row in user_roles.
--
-- Effective permissions / account-visibility scope aggregate across EVERY role
-- in user_roles (see PermissionsService.getUserAccessContext), so adding a role
-- only ever grants — it never removes the capabilities of another role.

CREATE TABLE IF NOT EXISTS user_roles (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Backfill: seed the junction from each user's existing primary role so nobody
-- loses access. Idempotent.
INSERT INTO user_roles (user_id, role_id)
SELECT id, role_id FROM users WHERE role_id IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Grant Siona both Admin and Account Manager. This is data configuration, not
-- application logic — the app never special-cases her name; it simply reads the
-- roles she holds. Admin remains her primary role (users.role_id is unchanged);
-- account-manager is added so business logic that keys off the Account Manager
-- role (auto AM assignment + Service Provider registration + AM-scoped
-- visibility) now recognises her. Idempotent.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
  FROM users u
 CROSS JOIN roles r
 WHERE LOWER(u.email) = 'siona.thomas@reflectionsinfos.com'
   AND r.key IN ('admin', 'account-manager')
ON CONFLICT (user_id, role_id) DO NOTHING;
