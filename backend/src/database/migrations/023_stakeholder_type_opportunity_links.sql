-- Stakeholder categorization (Client vs Service Provider) + department, and
-- opportunity-level client/service-provider stakeholder assignment.
--
-- Existing stakeholders default to CLIENT with no department (spec-mandated
-- safe default); existing opportunities default both new FKs to NULL.

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS stakeholder_type TEXT NOT NULL DEFAULT 'CLIENT';
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS department VARCHAR(150);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stk_type') THEN
    ALTER TABLE stakeholders ADD CONSTRAINT chk_stk_type
      CHECK (stakeholder_type IN ('CLIENT','SERVICE_PROVIDER'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stk_type ON stakeholders(stakeholder_type) WHERE is_deleted = FALSE;

-- Opportunity stakeholder assignment (nullable; same-account + type match
-- enforced in the service layer, not by the FK itself).
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS client_stakeholder_id TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS service_provider_stakeholder_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_opp_client_stakeholder') THEN
    ALTER TABLE opportunities ADD CONSTRAINT fk_opp_client_stakeholder
      FOREIGN KEY (client_stakeholder_id) REFERENCES stakeholders(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_opp_service_provider_stakeholder') THEN
    ALTER TABLE opportunities ADD CONSTRAINT fk_opp_service_provider_stakeholder
      FOREIGN KEY (service_provider_stakeholder_id) REFERENCES stakeholders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_opp_client_stakeholder ON opportunities(client_stakeholder_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_opp_service_provider_stakeholder ON opportunities(service_provider_stakeholder_id) WHERE is_deleted = FALSE;
