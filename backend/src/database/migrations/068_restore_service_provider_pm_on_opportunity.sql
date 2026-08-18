-- Migration 068: Restore service_provider_pm_id on opportunities.

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS service_provider_pm_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_opp_service_provider_pm ON opportunities(service_provider_pm_id);
