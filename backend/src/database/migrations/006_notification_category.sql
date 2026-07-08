-- Add notification_category column to classify notifications as BUSINESS or SYSTEM.
-- Default is BUSINESS for backward compatibility with existing rows.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_category TEXT NOT NULL DEFAULT 'BUSINESS';

CREATE INDEX IF NOT EXISTS idx_notif_user_cat ON notifications(user_id, notification_category);

-- Apply FK constraint on notifications.user_id and add category CHECK idempotently.
DO $fk_notif$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_user') THEN
    ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_notif_category') THEN
    ALTER TABLE notifications ADD CONSTRAINT chk_notif_category
      CHECK (notification_category IN ('BUSINESS', 'SYSTEM'));
  END IF;
END $fk_notif$;
