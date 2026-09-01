-- Migration 079: Allow Multiple SQA Tracker Snapshots Per Record
-- Drops the unique constraint so every update creates a distinct historical snapshot entry.

DROP INDEX IF EXISTS uq_sqa_tracker_record_week;
