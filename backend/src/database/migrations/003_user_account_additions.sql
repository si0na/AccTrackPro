-- Add account-security columns to users and soft-delete support to stakeholders.

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until    TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login      TIMESTAMPTZ;

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
