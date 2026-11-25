-- Migration 113: Action Item Dual-Channel Notifications tracking table
-- Tracks delivery status, timestamps, and error details separately for EMAIL and IN_APP channels.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'action_item_email_notifications' AND table_type = 'BASE TABLE') THEN
    ALTER TABLE action_item_email_notifications ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'EMAIL' CHECK (channel IN ('EMAIL', 'IN_APP'));
    ALTER TABLE action_item_email_notifications ADD COLUMN IF NOT EXISTS recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE action_item_email_notifications ADD COLUMN IF NOT EXISTS in_app_notification_id TEXT REFERENCES notifications(id) ON DELETE SET NULL;
    ALTER TABLE action_item_email_notifications RENAME TO action_item_notifications;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS action_item_notifications (
  id                      TEXT        PRIMARY KEY,
  action_item_id          TEXT        NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
  notification_type       TEXT        NOT NULL CHECK (notification_type IN ('CREATED', 'DUE')),
  channel                 TEXT        NOT NULL CHECK (channel IN ('EMAIL', 'IN_APP')),
  due_date                TEXT        NOT NULL DEFAULT '',
  recipient_email         TEXT        NOT NULL DEFAULT '',
  recipient_user_id       TEXT        REFERENCES users(id) ON DELETE SET NULL,
  recipient_name          TEXT        NOT NULL DEFAULT '',
  status                  TEXT        NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  attempt_count           INTEGER     NOT NULL DEFAULT 0,
  last_attempt_at         TIMESTAMPTZ,
  sent_at                 TIMESTAMPTZ,
  in_app_notification_id  TEXT        REFERENCES notifications(id) ON DELETE SET NULL,
  error_details           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backward compatibility view if anything references action_item_email_notifications
CREATE OR REPLACE VIEW action_item_email_notifications AS
  SELECT * FROM action_item_notifications WHERE channel = 'EMAIL';

-- Index for searching notifications by action_item_id
CREATE INDEX IF NOT EXISTS idx_ain_action_item_id
  ON action_item_notifications(action_item_id);

-- Index for checking pending/failed notifications by status, channel, & type
CREATE INDEX IF NOT EXISTS idx_ain_status_channel
  ON action_item_notifications(status, channel, notification_type);

-- Unique index to guarantee at most ONE notification per action item and channel for CREATED
CREATE UNIQUE INDEX IF NOT EXISTS idx_ain_unique_created
  ON action_item_notifications(action_item_id, channel)
  WHERE notification_type = 'CREATED';

-- Unique index to guarantee at most ONE notification per action item, channel, and due date for DUE
CREATE UNIQUE INDEX IF NOT EXISTS idx_ain_unique_due
  ON action_item_notifications(action_item_id, channel, due_date)
  WHERE notification_type = 'DUE';
