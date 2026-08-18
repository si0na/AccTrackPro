-- Migration 066: Remove service_provider_pm_id from opportunities.

DROP INDEX IF EXISTS idx_opp_service_provider_pm;

ALTER TABLE opportunities
  DROP COLUMN IF EXISTS service_provider_pm_id;
