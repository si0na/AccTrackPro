-- Migration 112: Account Weekly Health History Table
-- Dedicated table for maintaining and viewing weekly account health updates over time.

CREATE TABLE IF NOT EXISTS account_weekly_health (
  id                      TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id              TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reporting_date          DATE        NOT NULL,
  health_status           TEXT        NOT NULL CHECK (health_status IN ('Green', 'Amber', 'Red')),
  summary                 TEXT        NOT NULL,
  key_updates             TEXT        NOT NULL DEFAULT '',
  risks_and_issues        TEXT        NOT NULL DEFAULT '',
  action_items_mitigation TEXT        NOT NULL DEFAULT '',
  owner                   TEXT        NOT NULL DEFAULT '',
  owner_id                TEXT        REFERENCES users(id) ON DELETE SET NULL,
  next_steps              TEXT        NOT NULL DEFAULT '',
  created_by              TEXT        REFERENCES users(id) ON DELETE SET NULL,
  updated_by              TEXT        REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_account_weekly_health_date UNIQUE (account_id, reporting_date)
);

CREATE INDEX IF NOT EXISTS idx_awh_account_date ON account_weekly_health(account_id, reporting_date DESC);
CREATE INDEX IF NOT EXISTS idx_awh_account_id ON account_weekly_health(account_id);
