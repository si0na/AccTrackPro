-- Migration 116: Add created_at / updated_at timestamps where missing.
-- New columns are added with DEFAULT NOW(); existing rows are then backfilled from the
-- sibling timestamp. NOW() is constant within the migration transaction, so the
-- backfill only touches rows that were just defaulted, and re-running is harmless.

ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE comments SET updated_at = created_at WHERE updated_at = NOW();

ALTER TABLE project_team_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE project_team_members SET updated_at = created_at WHERE updated_at = NOW();

ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE financial_years SET updated_at = created_at WHERE updated_at = NOW();

ALTER TABLE financial_calendar ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE financial_calendar SET created_at = updated_at WHERE created_at = NOW();

ALTER TABLE administration_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE administration_settings SET created_at = updated_at WHERE created_at = NOW();

ALTER TABLE column_configs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE column_configs SET created_at = updated_at WHERE created_at = NOW();
