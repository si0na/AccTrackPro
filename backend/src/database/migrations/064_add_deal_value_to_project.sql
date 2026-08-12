-- Migration 064: Add deal_value column to projects table.
--
-- Stores the project's contract or deal value. Idempotent.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deal_value NUMERIC(15, 2);
