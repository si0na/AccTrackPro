-- User-level data isolation: replace the global account-name unique index with a
-- per-user one so different users may independently create accounts with the same
-- name, while names remain unique within each user's own portfolio.
--
-- Uses a DO block (guarded) so the file is safe to re-run and handles any
-- pre-existing data that would block the new index.

DO $$
BEGIN
  -- Drop the old global unique index (replaced by per-user below).
  -- IF NOT EXISTS is not supported for DROP INDEX in all versions, so check first.
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_acc_name_active') THEN
    DROP INDEX uq_acc_name_active;
  END IF;

  -- Create per-user unique index: within one user's active accounts, names must
  -- be unique (case-insensitive, trimmed). NULL owner_id rows are excluded so
  -- legacy seed data never blocks the index.
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_acc_name_user_active') THEN
    -- Guard: skip if there are already per-user duplicate names (shouldn't happen
    -- after a fresh install, but protects existing databases during migration).
    IF (
      SELECT COUNT(*) FROM (
        SELECT owner_id, LOWER(TRIM(name))
        FROM accounts
        WHERE is_deleted = FALSE AND owner_id IS NOT NULL
        GROUP BY owner_id, LOWER(TRIM(name))
        HAVING COUNT(*) > 1
      ) dups
    ) = 0 THEN
      CREATE UNIQUE INDEX uq_acc_name_user_active
        ON accounts (owner_id, LOWER(TRIM(name)))
        WHERE is_deleted = FALSE AND owner_id IS NOT NULL;
    ELSE
      RAISE NOTICE 'Skipped uq_acc_name_user_active — per-user duplicate names already exist in this database.';
    END IF;
  END IF;
END $$;
