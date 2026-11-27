-- Migration 118: intentionally a no-op.
-- The original inserted placeholder NPS responses (score 9, synthetic respondent
-- "Sarah Jenkins") for every project without NPS. On production this would have
-- created 46 fake records. Disabled pending a product decision.
SELECT 1;
