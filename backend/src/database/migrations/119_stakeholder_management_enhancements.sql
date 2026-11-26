-- Migration 112: Stakeholder Management Enhancement
-- Adds optional metadata, relationship RAG values, and planning fields to stakeholders.

-- 1. Add new optional columns
ALTER TABLE stakeholders
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS key_priorities TEXT,
  ADD COLUMN IF NOT EXISTS pain_points_insights TEXT,
  ADD COLUMN IF NOT EXISTS last_connect DATE,
  ADD COLUMN IF NOT EXISTS next_connect DATE,
  ADD COLUMN IF NOT EXISTS next_connect_status TEXT,
  ADD COLUMN IF NOT EXISTS action_follow_ups TEXT,
  ADD COLUMN IF NOT EXISTS comments TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS estimated_budget_available NUMERIC,
  ADD COLUMN IF NOT EXISTS role_in_decision TEXT;

-- 2. Add check constraints for new enum/numeric columns (allowing NULL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'stakeholders'::regclass AND conname = 'chk_stakeholders_area') THEN
    ALTER TABLE stakeholders ADD CONSTRAINT chk_stakeholders_area
      CHECK (area IS NULL OR area IN ('AI', 'Cloud', 'Cyber Security', 'Data', 'Application Development', 'GCC', 'Application Support/AMS', 'SharePoint', 'QA', 'Projects', 'Others'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'stakeholders'::regclass AND conname = 'chk_stakeholders_next_connect_status') THEN
    ALTER TABLE stakeholders ADD CONSTRAINT chk_stakeholders_next_connect_status
      CHECK (next_connect_status IS NULL OR next_connect_status IN ('Scheduled', 'Cancelled', 'Rescheduled', 'Follow up required', 'Yet to Schedule'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'stakeholders'::regclass AND conname = 'chk_stakeholders_role_in_decision') THEN
    ALTER TABLE stakeholders ADD CONSTRAINT chk_stakeholders_role_in_decision
      CHECK (role_in_decision IS NULL OR role_in_decision IN ('Decision Maker', 'Sponsor', 'Influencer', 'User', 'Procurement', 'Gatekeeper', 'Other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'stakeholders'::regclass AND conname = 'chk_stakeholders_budget_positive') THEN
    ALTER TABLE stakeholders ADD CONSTRAINT chk_stakeholders_budget_positive
      CHECK (estimated_budget_available IS NULL OR estimated_budget_available >= 0);
  END IF;
END $$;

-- 3. Verify complete existing definition of stakeholders_relationship_check and replace safely
DO $$
DECLARE
  v_def TEXT;
  v_expected_def TEXT := 'CHECK ((relationship = ANY (ARRAY[''Strong''::text, ''Neutral''::text, ''Weak''::text])))';
BEGIN
  -- Look up ONLY the exact verified constraint on the stakeholders table
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conrelid = 'stakeholders'::regclass
    AND conname = 'stakeholders_relationship_check'
    AND contype = 'c';

  -- Handle idempotency if already migrated
  IF v_def IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'stakeholders'::regclass
        AND conname = 'chk_stakeholders_relationship'
        AND contype = 'c'
    ) THEN
      RAISE NOTICE 'Constraint "chk_stakeholders_relationship" already exists — skipping replacement.';
      RETURN;
    ELSE
      RAISE EXCEPTION 'Safety check failed: Expected constraint "stakeholders_relationship_check" on table "stakeholders" was not found.';
    END IF;
  END IF;

  -- Verify the complete definition against the exact expected schema
  IF v_def <> v_expected_def THEN
    RAISE EXCEPTION 'Safety check failed: Constraint "stakeholders_relationship_check" definition differs from expected schema. Found: "%", Expected: "%"', v_def, v_expected_def;
  END IF;

  -- Drop only the verified exact constraint
  ALTER TABLE stakeholders DROP CONSTRAINT stakeholders_relationship_check;

  -- Add the new constraint with approved values (Strong, Weak, Neutral, No Relationship)
  ALTER TABLE stakeholders ADD CONSTRAINT chk_stakeholders_relationship
    CHECK (relationship IN ('Strong', 'Weak', 'Neutral', 'No Relationship'));
END $$;
