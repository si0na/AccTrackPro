-- Enforce globally-unique account names (case-insensitive, trimmed) across all
-- users. Replaces migration 020's per-user index (uq_acc_name_user_active) with
-- a global partial unique index so no two active accounts — regardless of owner —
-- can share the same name.
--
-- The application-side assertNameAvailable() check is the primary guard; this
-- index is the race-safe backstop for concurrent requests that both pass the
-- app check before either commits.
--
-- Guarded: if cross-user duplicates already exist in active rows the new index
-- cannot be built — we skip and emit a NOTICE rather than failing the migration
-- run. The application-side check still prevents new duplicates; a DBA should
-- resolve the existing ones before re-running.

DO $$
BEGIN
  -- Drop the per-user unique index introduced in migration 020.
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_acc_name_user_active') THEN
    DROP INDEX uq_acc_name_user_active;
  END IF;

  -- Recreate the global unique index (originally from migration 017, then
  -- narrowed to per-user in 020 — now restored to global scope).
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_acc_name_active') THEN
    -- Guard: skip if any two active accounts already share a normalised name
    -- across different owners.
    IF (
      SELECT COUNT(*) FROM (
        SELECT LOWER(TRIM(name))
        FROM accounts
        WHERE is_deleted = FALSE
        GROUP BY LOWER(TRIM(name))
        HAVING COUNT(*) > 1
      ) dups
    ) = 0 THEN
      CREATE UNIQUE INDEX uq_acc_name_active
        ON accounts (LOWER(TRIM(name)))
        WHERE is_deleted = FALSE;
    ELSE
      RAISE NOTICE 'Skipped uq_acc_name_active — cross-user duplicate account names already exist. Resolve duplicates and re-run this migration.';
    END IF;
  END IF;
END $$;
