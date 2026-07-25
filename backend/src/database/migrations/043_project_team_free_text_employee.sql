-- Team Tab "Employee Name" becomes a free-text field instead of a FK to
-- users, so external consultants/contractors/future hires without a system
-- account can be added to a project's team roster.
ALTER TABLE project_team_members ADD COLUMN employee_name TEXT;
UPDATE project_team_members ptm SET employee_name = u.name
  FROM users u WHERE ptm.employee_id = u.id;
UPDATE project_team_members SET employee_name = '' WHERE employee_name IS NULL;
ALTER TABLE project_team_members ALTER COLUMN employee_name SET NOT NULL;
ALTER TABLE project_team_members DROP COLUMN employee_id;
