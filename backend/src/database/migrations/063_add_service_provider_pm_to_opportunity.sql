-- Migration 063: Add service_provider_pm_id to opportunities.
--
-- Stores the FK to a System User who acts as the Service Provider Project
-- Manager for this opportunity. The field is nullable so every existing
-- opportunity remains valid without re-seeding.
--
-- Column type TEXT mirrors users.id (gen_random_uuid()::TEXT).
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS service_provider_pm_id TEXT
  REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opp_service_provider_pm
  ON opportunities(service_provider_pm_id)
  WHERE is_deleted = FALSE;
