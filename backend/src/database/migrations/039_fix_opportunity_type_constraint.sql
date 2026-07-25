-- Corrects a stale chk_opp_type constraint.
--
-- Migration 024 introduced chk_opp_type guarded by "IF NOT EXISTS (SELECT 1
-- FROM pg_constraint ...)", intending to allow Growth/Pursuit/Whitespace/New/
-- Extension. But an earlier version of that constraint (only Growth/Pursuit/
-- Whitespace) had already been applied to this database before the file was
-- updated to the full 5-value list. Because the guard only checks whether a
-- constraint named chk_opp_type exists — not whether its definition is
-- current — the live database kept the old 3-value constraint forever, even
-- though the DTO, entity types, frontend and import/export schema all
-- correctly support all 5 Opportunity Types.
--
-- Result: creating or updating an Opportunity with Opportunity Type 'New' or
-- 'Extension' throws an unhandled Postgres CheckViolation, surfaced to
-- clients as a generic 500 Internal Server Error.
--
-- Fix: drop and recreate chk_opp_type with the full, currently-intended value
-- list. Unconditional (not guarded by IF NOT EXISTS) so it also repairs
-- databases that already have the stale definition.

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_type;
ALTER TABLE opportunities ADD CONSTRAINT chk_opp_type
  CHECK (opportunity_type IN ('Growth','Pursuit','Whitespace','New','Extension'));
