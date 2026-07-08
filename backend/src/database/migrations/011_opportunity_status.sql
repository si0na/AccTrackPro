-- Add lifecycle status (Open / Won / Lost) to opportunities.
-- Standard CRM lifecycle: an opportunity remains operationally visible until
-- it is closed. Forecasts exclude Lost deals.

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Open';

DO $opp_status$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_status') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_status
      CHECK (status IN ('Open','Won','Lost'));
  END IF;
  -- One-time backfill: rows created before the status column existed derive
  -- their initial status from the pipeline stage.
  IF NOT EXISTS (SELECT 1 FROM administration_settings WHERE key = 'opp_status_backfill_v1') THEN
    UPDATE opportunities SET status = 'Won' WHERE stage = 'Won';
    INSERT INTO administration_settings (key, value) VALUES ('opp_status_backfill_v1', 'done');
  END IF;
END $opp_status$;

CREATE INDEX IF NOT EXISTS idx_opp_status ON opportunities(status) WHERE is_deleted = FALSE;
