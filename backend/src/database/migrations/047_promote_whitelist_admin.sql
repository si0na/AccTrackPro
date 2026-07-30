-- Promote pre-existing users to the role their employee_master (whitelist) row
-- designates — specifically the Admin role.
--
-- Migration 046 seeds employee_master.role_id (admin for the seeded admin email)
-- and copies role/department/designation onto NEW users at registration. But
-- users who registered BEFORE 046 were backfilled from the legacy free-text
-- role column (all 'Account Manager'), so a pre-existing intended admin ends up
-- as account-manager — leaving no one able to reach Role & Permission
-- Management. This migration syncs those users to the admin role.
--
-- Idempotent: re-running keeps admins as admins. Only promotes to admin (it does
-- not downgrade or reshuffle other roles).

UPDATE users u
   SET role_id = em.role_id,
       role    = r.name,
       updated_at = NOW()
  FROM employee_master em
  JOIN roles r ON r.id = em.role_id
 WHERE LOWER(u.email) = LOWER(em.email)
   AND em.role_id IS NOT NULL
   AND r.key = 'admin'
   AND (u.role_id IS DISTINCT FROM em.role_id);
