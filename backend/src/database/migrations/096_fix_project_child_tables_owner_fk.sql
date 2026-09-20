-- Migration 096: Drop strict FK constraints on project child tables (risks, assumptions, issues, dependencies)
-- for owner_id to support both registered Users and custom Project Team Members.

ALTER TABLE project_risks DROP CONSTRAINT IF EXISTS project_risks_owner_id_fkey;
ALTER TABLE project_assumptions DROP CONSTRAINT IF EXISTS project_assumptions_owner_id_fkey;
ALTER TABLE project_issues DROP CONSTRAINT IF EXISTS project_issues_owner_id_fkey;
ALTER TABLE project_dependencies DROP CONSTRAINT IF EXISTS project_dependencies_owner_id_fkey;
