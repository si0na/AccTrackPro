-- Migration 115: Update action_item_notifications notification_type check constraint and indexes
-- Supports 'ACTION_ITEM_CREATED' and 'ACTION_ITEM_DUE', while preserving backwards compatibility.

-- 1. Update check constraint
ALTER TABLE action_item_notifications DROP CONSTRAINT IF EXISTS action_item_notifications_notification_type_check;
ALTER TABLE action_item_notifications ADD CONSTRAINT action_item_notifications_notification_type_check
  CHECK (notification_type IN ('ACTION_ITEM_CREATED', 'ACTION_ITEM_DUE', 'CREATED', 'DUE'));

-- 2. Migrate existing historical rows to new event names
UPDATE action_item_notifications SET notification_type = 'ACTION_ITEM_CREATED' WHERE notification_type = 'CREATED';
UPDATE action_item_notifications SET notification_type = 'ACTION_ITEM_DUE' WHERE notification_type = 'DUE';

-- 3. Update unique deduplication indexes
DROP INDEX IF EXISTS idx_ain_unique_created;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ain_unique_created
  ON action_item_notifications(action_item_id, channel)
  WHERE notification_type IN ('ACTION_ITEM_CREATED', 'CREATED');

DROP INDEX IF EXISTS idx_ain_unique_due;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ain_unique_due
  ON action_item_notifications(action_item_id, channel, due_date)
  WHERE notification_type IN ('ACTION_ITEM_DUE', 'DUE');
