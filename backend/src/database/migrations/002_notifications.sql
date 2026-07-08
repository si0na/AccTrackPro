-- Add notifications table and its indexes.

CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT        PRIMARY KEY,
  user_id        TEXT        NOT NULL,
  type           TEXT        NOT NULL,
  event_type     TEXT        NOT NULL,
  title          TEXT        NOT NULL,
  message        TEXT        NOT NULL,
  severity       TEXT        NOT NULL DEFAULT 'Info',
  account_id     TEXT        REFERENCES accounts(id) ON DELETE SET NULL,
  opportunity_id TEXT        REFERENCES opportunities(id) ON DELETE SET NULL,
  action_item_id TEXT        REFERENCES action_items(id) ON DELETE SET NULL,
  stakeholder_id TEXT        REFERENCES stakeholders(id) ON DELETE SET NULL,
  document_id    TEXT,
  is_read        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at        TIMESTAMPTZ,
  metadata       JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_notif_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread  ON notifications(user_id, is_read) WHERE is_read = FALSE;
