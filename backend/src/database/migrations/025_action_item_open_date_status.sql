-- Action Item lifecycle expansion: 'To Do' replaces 'Not Started' (same
-- first-state semantics, existing rows relabeled) and a 'Cancelled' status is
-- added. An open_date column tracks when the task was opened; existing rows
-- backfill from created_at so reporting/filtering never has to special-case
-- blanks.

-- The old constraint must go first — it doesn't allow 'To Do', so relabeling
-- 'Not Started' rows under it would fail.
ALTER TABLE action_items DROP CONSTRAINT IF EXISTS action_items_status_check;
ALTER TABLE action_items DROP CONSTRAINT IF EXISTS chk_ai_status;

UPDATE action_items SET status = 'To Do' WHERE status = 'Not Started';

ALTER TABLE action_items ADD CONSTRAINT chk_ai_status
  CHECK (status IN ('To Do','In Progress','Blocked','Completed','Cancelled'));
ALTER TABLE action_items ALTER COLUMN status SET DEFAULT 'To Do';

ALTER TABLE action_items ADD COLUMN IF NOT EXISTS open_date TEXT NOT NULL DEFAULT '';

DO $ai_open_date$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM administration_settings WHERE key = 'ai_open_date_backfill_v1') THEN
    UPDATE action_items SET open_date = to_char(created_at, 'YYYY-MM-DD') WHERE open_date = '';
    INSERT INTO administration_settings (key, value) VALUES ('ai_open_date_backfill_v1', 'done');
  END IF;
END $ai_open_date$;

CREATE INDEX IF NOT EXISTS idx_ai_open_date ON action_items(open_date) WHERE is_deleted = FALSE;
