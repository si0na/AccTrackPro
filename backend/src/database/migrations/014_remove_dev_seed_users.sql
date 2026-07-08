-- Production hardening: remove development seed users and add missing index.

-- ── Remove development/seed users ─────────────────────────────────────────────
-- These four accounts are created only by `npm run seed:dev` (seed.script.ts)
-- with the shared password "password123". They must not exist in production.
-- The delete is targeted at the exact known seed emails — it never touches
-- real user accounts. All FKs to users are ON DELETE CASCADE (refresh_tokens,
-- password_reset_tokens, notifications, custom_columns, column_configs) or
-- ON DELETE SET NULL (owner_id / user_id / created_by columns), so business
-- data owned by these users is preserved with ownership cleared.
DELETE FROM users
WHERE LOWER(email) IN (
  'john.smith@enterprise.com',
  'sarah.johnson@enterprise.com',
  'mike.brown@enterprise.com',
  'lisa.davis@enterprise.com'
);

-- ── Missing performance index ─────────────────────────────────────────────────
-- alerts.service.ts joins activities.opportunity_id = opportunities.id; every
-- other FK lookup path already has an index (see 001/002/005/006/010–013).
CREATE INDEX IF NOT EXISTS idx_act_opportunity ON activities(opportunity_id);
