-- Blocked / Delayed reason capture for opportunities.
--
-- These are SEPARATE business concepts from risks_and_dependencies (030) and
-- from close_reason (016):
--   • risks_and_dependencies — ongoing business/project risks (any stage)
--   • close_reason           — why a deal was Won or Lost
--   • blocked_reason         — why the opportunity cannot currently progress
--   • delayed_reason         — why progress has been postponed
--
-- Both are optional/nullable and only meaningful while the opportunity is in the
-- matching stage; the service clears the value when the stage moves elsewhere.

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS delayed_reason TEXT;
