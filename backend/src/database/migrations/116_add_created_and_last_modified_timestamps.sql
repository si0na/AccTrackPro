-- Migration 116: Add created_at and updated_at timestamps where missing across ReflectOne tables

-- 1. comments: add updated_at
ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE comments SET updated_at = created_at WHERE updated_at IS NULL;

-- 2. project_team_members: add updated_at
ALTER TABLE project_team_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE project_team_members SET updated_at = created_at WHERE updated_at IS NULL;

-- 3. financial_years: add updated_at
ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE financial_years SET updated_at = created_at WHERE updated_at IS NULL;

-- 4. financial_calendar: add created_at
ALTER TABLE financial_calendar ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE financial_calendar SET created_at = updated_at WHERE created_at IS NULL;

-- 5. administration_settings: add created_at
ALTER TABLE administration_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE administration_settings SET created_at = updated_at WHERE created_at IS NULL;

-- 6. column_configs: add created_at
ALTER TABLE column_configs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE column_configs SET created_at = updated_at WHERE created_at IS NULL;
