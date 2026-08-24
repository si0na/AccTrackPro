-- Adds business fields: Tower, Delivery Model, Billing Model across Accounts, Opportunities, and Projects.
-- Also adds Priority to Projects (Opportunity already has Priority in 072).

-- 1. Accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tower TEXT;

DO $acc_tower$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acc_tower') THEN
    ALTER TABLE accounts ADD CONSTRAINT chk_acc_tower
      CHECK (tower IS NULL OR tower IN ('Tower 1', 'Tower 2'));
  END IF;
END $acc_tower$;

-- 2. Opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS delivery_model TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS billing_model TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS tower TEXT;

DO $opp_delivery_model$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_delivery_model') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_delivery_model
      CHECK (delivery_model IS NULL OR delivery_model IN ('Staff Aug', 'Fixed Bid', 'Managed', 'Fixed Capacity', 'Others'));
  END IF;
END $opp_delivery_model$;

DO $opp_billing_model$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_billing_model') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_billing_model
      CHECK (billing_model IS NULL OR billing_model IN ('T&M', 'Milestone Based', 'Monthly Fixed', 'Others'));
  END IF;
END $opp_billing_model$;

DO $opp_tower$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_tower') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_tower
      CHECK (tower IS NULL OR tower IN ('Tower 1', 'Tower 2'));
  END IF;
END $opp_tower$;

-- 3. Projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivery_model TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS billing_model TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tower TEXT;

DO $proj_priority$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proj_priority') THEN
    ALTER TABLE projects ADD CONSTRAINT chk_proj_priority
      CHECK (priority IS NULL OR priority IN ('High', 'Medium', 'Low'));
  END IF;
END $proj_priority$;

DO $proj_delivery_model$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proj_delivery_model') THEN
    ALTER TABLE projects ADD CONSTRAINT chk_proj_delivery_model
      CHECK (delivery_model IS NULL OR delivery_model IN ('Staff Aug', 'Fixed Bid', 'Managed', 'Fixed Capacity', 'Others'));
  END IF;
END $proj_delivery_model$;

DO $proj_billing_model$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proj_billing_model') THEN
    ALTER TABLE projects ADD CONSTRAINT chk_proj_billing_model
      CHECK (billing_model IS NULL OR billing_model IN ('T&M', 'Milestone Based', 'Monthly Fixed', 'Others'));
  END IF;
END $proj_billing_model$;

DO $proj_tower$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proj_tower') THEN
    ALTER TABLE projects ADD CONSTRAINT chk_proj_tower
      CHECK (tower IS NULL OR tower IN ('Tower 1', 'Tower 2'));
  END IF;
END $proj_tower$;
