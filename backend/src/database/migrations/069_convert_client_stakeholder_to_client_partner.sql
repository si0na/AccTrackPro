-- Migration 069: Convert client_stakeholder_id on projects to client_partner_id referencing users.

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_client_stakeholder_id_fkey;

UPDATE projects SET client_stakeholder_id = NULL;

ALTER TABLE projects RENAME COLUMN client_stakeholder_id TO client_partner_id;

ALTER TABLE projects ADD CONSTRAINT fk_projects_client_partner
  FOREIGN KEY (client_partner_id) REFERENCES users(id) ON DELETE SET NULL;
