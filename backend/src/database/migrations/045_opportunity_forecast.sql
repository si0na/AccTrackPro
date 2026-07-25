-- Opportunity Forecast Management
--
-- Adds persisted per-opportunity forecast + actual revenue tracking. Until now
-- "forecast" was purely a derived analytics aggregation (value × probability)
-- with no stored forecast date, forecast deal value, actuals, or revision
-- history. This migration introduces two tables:
--
--   opportunity_forecasts          — the CURRENT forecast + actuals for an
--                                    opportunity (one row per opportunity).
--   opportunity_forecast_history   — an append-only audit trail: one row per
--                                    forecast revision (previous forecast date /
--                                    value), so changes can be tracked over time.
--
-- Both maintain relationships with the opportunity (and, denormalised for
-- reporting, the account). Rows cascade-delete with the parent opportunity.

-- ── Current forecast + actuals (one per opportunity) ──────────────────────────
CREATE TABLE IF NOT EXISTS opportunity_forecasts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  opportunity_id  TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  account_id      TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  -- Forecast (editable): the expected close date and expected deal value.
  forecast_date   DATE,
  forecast_value  NUMERIC(15,2),
  -- Actuals (editable): the realised revenue date/amount and optional remarks.
  actual_date     DATE,
  actual_value    NUMERIC(15,2),
  remarks         TEXT,
  -- Audit: who last saved the forecast and when.
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One forecast record per opportunity (the current values); history is separate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_opp_forecast_opportunity
  ON opportunity_forecasts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_forecast_account
  ON opportunity_forecasts(account_id);

-- ── Forecast revision history (append-only audit trail) ───────────────────────
CREATE TABLE IF NOT EXISTS opportunity_forecast_history (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  opportunity_id  TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  forecast_date   DATE,
  forecast_value  NUMERIC(15,2),
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opp_forecast_hist_opportunity
  ON opportunity_forecast_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_forecast_hist_created
  ON opportunity_forecast_history(created_at DESC);
