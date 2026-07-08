-- Initial schema: all core tables and indexes.
-- Every statement is idempotent (IF NOT EXISTS) so this file is safe to re-run.

CREATE TABLE IF NOT EXISTS financial_years (
  id         TEXT        PRIMARY KEY,
  fy_label   TEXT        NOT NULL UNIQUE,
  start_year INTEGER     NOT NULL,
  start_date DATE        NOT NULL,
  end_date   DATE        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT          PRIMARY KEY,
  name         TEXT          NOT NULL,
  type         TEXT          NOT NULL CHECK (type IN ('Growth','Pursuit','Project')),
  health       TEXT          NOT NULL CHECK (health IN ('Healthy','At Risk','Critical')),
  owner        TEXT          NOT NULL,
  revenue      NUMERIC(15,2) NOT NULL DEFAULT 0,
  industry     TEXT          NOT NULL DEFAULT '',
  since        TEXT          NOT NULL DEFAULT '',
  website      TEXT          NOT NULL DEFAULT '',
  phone        TEXT          NOT NULL DEFAULT '',
  email        TEXT          NOT NULL DEFAULT '',
  address      TEXT          NOT NULL DEFAULT '',
  description  TEXT          NOT NULL DEFAULT '',
  custom_data  JSONB         NOT NULL DEFAULT '{}',
  is_deleted   BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id             TEXT          PRIMARY KEY,
  name           TEXT          NOT NULL,
  account_id     TEXT          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  stage          TEXT          NOT NULL CHECK (stage IN ('Lead','Qualified','Proposal','Negotiation','Won')),
  value          NUMERIC(15,2) NOT NULL DEFAULT 0,
  probability    INTEGER       NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  owner          TEXT          NOT NULL,
  close_date     TEXT          NOT NULL DEFAULT '',
  start_date     TEXT          NOT NULL DEFAULT '',
  end_date       TEXT          NOT NULL DEFAULT '',
  crm_value      NUMERIC(15,2) NOT NULL DEFAULT 0,
  description    TEXT          NOT NULL DEFAULT '',
  next_step      TEXT          NOT NULL DEFAULT '',
  tags           TEXT[]        NOT NULL DEFAULT '{}',
  team           TEXT[]        NOT NULL DEFAULT '{}',
  custom_data    JSONB         NOT NULL DEFAULT '{}',
  is_deleted     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_items (
  id              TEXT          PRIMARY KEY,
  title           TEXT          NOT NULL,
  account_id      TEXT          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  opportunity_id  TEXT          REFERENCES opportunities(id) ON DELETE SET NULL,
  owner           TEXT          NOT NULL,
  due_date        TEXT          NOT NULL DEFAULT '',
  priority        TEXT          NOT NULL CHECK (priority IN ('High','Medium','Low')),
  status          TEXT          NOT NULL CHECK (status IN ('Not Started','In Progress','Blocked','Completed')),
  notes           TEXT          NOT NULL DEFAULT '',
  completed_date  TEXT,
  custom_data     JSONB         NOT NULL DEFAULT '{}',
  is_deleted      BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stakeholders (
  id           TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  account_id   TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  designation  TEXT        NOT NULL DEFAULT '',
  influence    TEXT        NOT NULL CHECK (influence IN ('High','Medium','Low')),
  relationship TEXT        NOT NULL CHECK (relationship IN ('Strong','Neutral','Weak')),
  email        TEXT        NOT NULL DEFAULT '',
  phone        TEXT        NOT NULL DEFAULT '',
  is_deleted   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id             TEXT        PRIMARY KEY,
  type           TEXT        NOT NULL,
  text           TEXT        NOT NULL,
  user_name      TEXT        NOT NULL,
  account_id     TEXT        REFERENCES accounts(id) ON DELETE SET NULL,
  opportunity_id TEXT        REFERENCES opportunities(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id            TEXT        PRIMARY KEY,
  target_type   TEXT        NOT NULL CHECK (target_type IN ('account','opportunity','actionItem')),
  target_id     TEXT        NOT NULL,
  user_name     TEXT        NOT NULL,
  text          TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_columns (
  id         TEXT        PRIMARY KEY,
  module     TEXT        NOT NULL CHECK (module IN ('accounts','opportunities','actionItems')),
  key        TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('text','number','date','boolean')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS column_configs (
  module     TEXT        PRIMARY KEY CHECK (module IN ('accounts','opportunities','actionItems')),
  config     JSONB       NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id              TEXT        PRIMARY KEY,
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL UNIQUE,
  password_hash   TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'Account Manager',
  avatar_data     TEXT        NOT NULL DEFAULT '',
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  failed_attempts INTEGER     NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT        PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ,
  ip_address  TEXT        NOT NULL DEFAULT '',
  user_agent  TEXT        NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS auth_audit_log (
  id          TEXT        PRIMARY KEY,
  event       TEXT        NOT NULL,
  user_id     TEXT,
  email       TEXT        NOT NULL DEFAULT '',
  ip_address  TEXT        NOT NULL DEFAULT '',
  user_agent  TEXT        NOT NULL DEFAULT '',
  success     BOOLEAN     NOT NULL DEFAULT TRUE,
  details     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          TEXT        PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id            TEXT        PRIMARY KEY,
  account_id    TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  file_name     TEXT        NOT NULL,
  original_name TEXT        NOT NULL,
  mime_type     TEXT        NOT NULL DEFAULT '',
  size_bytes    BIGINT      NOT NULL DEFAULT 0,
  uploaded_by   TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_rt_user_id     ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_rt_token_hash  ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_hash       ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_aal_user_id    ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_aal_created    ON auth_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opp_account    ON opportunities(account_id)     WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ai_account     ON action_items(account_id)      WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ai_opportunity ON action_items(opportunity_id)  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_stk_account    ON stakeholders(account_id)      WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_act_account    ON activities(account_id);
CREATE INDEX IF NOT EXISTS idx_act_created    ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmt_target     ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_cc_module      ON custom_columns(module);
CREATE INDEX IF NOT EXISTS idx_doc_account    ON documents(account_id);
