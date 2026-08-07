-- The Health Tracker history should carry only summaries a user actually wrote.
-- Create Project, Edit Project and the migration-055 backfill used to stamp a
-- generated sentence into status_summary; those read as system noise in the
-- history list. Blank them out so such entries render as health-only entries
-- (status, updated by, updated on) with no invented description.
--
-- Data-only: no schema change, no rows removed — the audit trail keeps every
-- entry, including when the health was set and by whom.
UPDATE project_health_updates
SET status_summary = ''
WHERE status_summary IN (
        'Initial project health set at project creation.',
        'Project health updated during project edit.'
      )
   OR status_summary ~ '^Health changed from (Green|Amber|Red) to (Green|Amber|Red) via Edit Project\.$';
