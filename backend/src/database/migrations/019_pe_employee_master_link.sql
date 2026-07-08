-- Integrate Performance Evaluations with the Employee Master.
--
-- 1. employee_master gains a display name (it previously held only emails),
--    backfilled from registered users where the email matches.
-- 2. performance_evaluations gains employee_id referencing employee_master.
--    ON DELETE SET NULL: removing someone from the whitelist must not erase
--    their evaluation history — the denormalized employee_name remains.
-- 3. Integrity: one evaluation per employee per month (partial unique index,
--    guarded in case legacy data already violates it).

ALTER TABLE employee_master ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';

DO $pe_link$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_evaluations' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE performance_evaluations
      ADD COLUMN employee_id TEXT REFERENCES employee_master(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM administration_settings WHERE key = 'pe_employee_link_backfill_v1') THEN
    -- Names: take the registered user's name for each whitelisted email.
    UPDATE employee_master em SET name = u.name
    FROM users u
    WHERE LOWER(u.email) = LOWER(em.email) AND em.name = '';

    -- Link legacy evaluations whose free-text employee name exactly matches a
    -- master entry (case-insensitive). Ambiguous or unmatched names stay NULL.
    UPDATE performance_evaluations pe SET employee_id = em.id
    FROM employee_master em
    WHERE pe.employee_id IS NULL
      AND em.name <> ''
      AND LOWER(TRIM(pe.employee_name)) = LOWER(TRIM(em.name))
      AND (SELECT COUNT(*) FROM employee_master e2
           WHERE LOWER(TRIM(e2.name)) = LOWER(TRIM(em.name))) = 1;

    INSERT INTO administration_settings (key, value) VALUES ('pe_employee_link_backfill_v1', 'done');
  END IF;

  -- One evaluation per employee per month. Guarded: skip if legacy duplicates
  -- exist so the migration run never fails; the service enforces the rule for
  -- all new writes either way.
  IF NOT EXISTS (
    SELECT 1 FROM performance_evaluations
    WHERE is_deleted = FALSE AND employee_id IS NOT NULL
    GROUP BY employee_id, LOWER(TRIM(month))
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_pe_employee_month
      ON performance_evaluations (employee_id, LOWER(TRIM(month)))
      WHERE is_deleted = FALSE AND employee_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'uq_pe_employee_month skipped: duplicate employee/month evaluations exist';
  END IF;
END $pe_link$;

CREATE INDEX IF NOT EXISTS idx_pe_employee_id ON performance_evaluations(employee_id) WHERE is_deleted = FALSE;
