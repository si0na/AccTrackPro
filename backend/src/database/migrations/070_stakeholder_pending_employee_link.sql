-- Pending-registration employees as Service Providers.
--
-- Whitelisted employees (employee_master) who have not yet self-registered have
-- no `users` row, so `stakeholders.user_id` (FK -> users) cannot reference them
-- and they were invisible everywhere Service Providers are listed or picked.
-- This nullable `employee_id` links a SERVICE_PROVIDER stakeholder to the
-- whitelist record instead, so a pending person can be assigned as a Service
-- Provider before they ever log in.
--
-- On registration the row is upgraded in place (AuthService.register ->
-- ServiceProviderService.linkRegisteredUser): user_id is filled in and
-- employee_id is kept for provenance.
--
-- ON DELETE SET NULL mirrors fk_stk_user: removing a whitelist entry never
-- deletes historical stakeholder rows, it only detaches the link.

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS employee_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_stk_employee') THEN
    ALTER TABLE stakeholders ADD CONSTRAINT fk_stk_employee
      FOREIGN KEY (employee_id) REFERENCES employee_master(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stk_employee ON stakeholders(employee_id) WHERE is_deleted = FALSE;

-- One Service Provider stakeholder per (account, pending employee) — the
-- counterpart of uq_stk_account_user for people who have not registered yet.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stk_account_employee
  ON stakeholders(account_id, employee_id)
  WHERE stakeholder_type = 'SERVICE_PROVIDER' AND is_deleted = FALSE;

-- Backfill provenance for Service Provider stakeholders whose user already has
-- a whitelist row, so the two links stay consistent going forward.
UPDATE stakeholders s
SET employee_id = em.id
FROM users u
JOIN employee_master em ON LOWER(em.email) = LOWER(u.email)
WHERE s.user_id = u.id
  AND s.stakeholder_type = 'SERVICE_PROVIDER'
  AND s.is_deleted = FALSE
  AND s.employee_id IS NULL
  -- Never create a duplicate under uq_stk_account_employee.
  AND NOT EXISTS (
    SELECT 1 FROM stakeholders d
    WHERE d.account_id = s.account_id
      AND d.employee_id = em.id
      AND d.stakeholder_type = 'SERVICE_PROVIDER'
      AND d.is_deleted = FALSE
  );
