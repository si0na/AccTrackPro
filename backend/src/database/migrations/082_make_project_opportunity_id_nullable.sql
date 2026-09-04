-- Migration 082: Make opportunity_id optional on projects table for direct Project creation

ALTER TABLE projects ALTER COLUMN opportunity_id DROP NOT NULL;

DROP INDEX IF EXISTS uq_project_opportunity;
CREATE UNIQUE INDEX uq_project_opportunity ON projects(opportunity_id) WHERE opportunity_id IS NOT NULL AND is_deleted = FALSE;
