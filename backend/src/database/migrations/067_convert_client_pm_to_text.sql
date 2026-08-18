-- Migration 067: Convert client_pm_stakeholder_id to client_pm_name text column on projects.

-- 1. Drop foreign key constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_client_pm_stakeholder_id_fkey;

-- 2. Migrate existing stakeholder UUID references to their display names
UPDATE projects p
SET client_pm_stakeholder_id = s.name
FROM stakeholders s
WHERE p.client_pm_stakeholder_id = s.id;

-- 3. Rename the column client_pm_stakeholder_id to client_pm_name
ALTER TABLE projects RENAME COLUMN client_pm_stakeholder_id TO client_pm_name;
