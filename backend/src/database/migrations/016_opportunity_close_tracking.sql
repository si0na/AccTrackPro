-- Win/loss tracking for opportunities.
-- close_reason captures why a deal was Won or Lost (required by the service
-- when a deal transitions to a closed status); closed_at stamps when the deal
-- first reached a closed status and is cleared if the deal is reopened.

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS close_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- One-time backfill: deals already closed before this column existed get their
-- closed_at approximated from updated_at so reporting has a usable timestamp.
DO $opp_close$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM administration_settings WHERE key = 'opp_closed_at_backfill_v1') THEN
    UPDATE opportunities SET closed_at = updated_at WHERE status IN ('Won','Lost') AND closed_at IS NULL;
    INSERT INTO administration_settings (key, value) VALUES ('opp_closed_at_backfill_v1', 'done');
  END IF;
END $opp_close$;

CREATE INDEX IF NOT EXISTS idx_opp_closed_at ON opportunities(closed_at) WHERE is_deleted = FALSE AND closed_at IS NOT NULL;
