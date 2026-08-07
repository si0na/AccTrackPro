-- Project Health is now shown on the Project Overview, which reads the latest
-- entry from the Health Tracker's history. Projects created before the Health
-- Tracker existed have a `projects.health` value but no history at all, so the
-- Overview would show nothing for them. Seed one opening entry per such project,
-- backdated to the project's own creation, so every project's audit trail starts
-- at creation exactly as it now does for newly created projects.
INSERT INTO project_health_updates (project_id, health, status_summary, updated_by_id, created_at)
SELECT p.id,
       COALESCE(p.health, 'Green'),
       'Initial project health set at project creation.',
       p.owner_id,
       p.created_at
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM project_health_updates h WHERE h.project_id = p.id
);
