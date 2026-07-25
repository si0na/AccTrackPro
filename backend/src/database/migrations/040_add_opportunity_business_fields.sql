-- Adds 5 new Opportunity business fields: Opportunity Health, Revenue Model,
-- Location, Cost, Gross Margin. All optional/nullable so existing rows are
-- unaffected — mirrors the pattern used for service_line (028) and the
-- guarded-constraint idiom used throughout (026/028/039).

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS opportunity_health TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS revenue_model TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS cost NUMERIC(15,2);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS gross_margin NUMERIC(5,2);

DO $opp_health$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_health') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_health
      CHECK (opportunity_health IS NULL OR opportunity_health IN ('Green','Amber','Red'));
  END IF;
END $opp_health$;

DO $opp_revenue_model$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_revenue_model') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_revenue_model
      CHECK (revenue_model IS NULL OR revenue_model IN ('T&E','Fixed Bid','Fixed Capacity','Managed Services'));
  END IF;
END $opp_revenue_model$;

DO $opp_cost$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_cost') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_cost
      CHECK (cost IS NULL OR cost >= 0);
  END IF;
END $opp_cost$;

DO $opp_gross_margin$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_opp_gross_margin') THEN
    ALTER TABLE opportunities ADD CONSTRAINT chk_opp_gross_margin
      CHECK (gross_margin IS NULL OR (gross_margin >= 0 AND gross_margin <= 100));
  END IF;
END $opp_gross_margin$;
