-- Race-safe duplicate prevention for account names. The service has always
-- checked name availability application-side; this unique partial index closes
-- the race window between two concurrent creates and backs the restore guard.
--
-- Guarded: if legacy data already contains active duplicates the index cannot
-- be built — skip it (the application-side check still applies) rather than
-- fail the whole migration run; it will be created on a later run once the
-- duplicates are resolved manually.

DO $acc_uq$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE is_deleted = FALSE
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_name_active
      ON accounts (LOWER(TRIM(name))) WHERE is_deleted = FALSE;
  ELSE
    RAISE NOTICE 'uq_acc_name_active skipped: active duplicate account names exist';
  END IF;
END $acc_uq$;
