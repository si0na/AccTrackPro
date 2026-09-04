-- Migration 083: Employee Appreciation Module
-- Create table for Employee Appreciation under Employee Engagement section

CREATE TABLE IF NOT EXISTS employee_appreciation (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  received_date DATE NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  emp_id TEXT,
  employee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  respondent_id TEXT REFERENCES stakeholders(id) ON DELETE SET NULL,
  respondent_name TEXT NOT NULL,
  internal_external TEXT NOT NULL CHECK (internal_external IN ('Internal', 'External')),
  feedback TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_appreciation_account ON employee_appreciation(account_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employee_appreciation_project ON employee_appreciation(project_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employee_appreciation_date ON employee_appreciation(received_date DESC) WHERE is_deleted = FALSE;

-- Register module in RBAC
INSERT INTO modules (key, name, sort_order) VALUES ('employeeAppreciation', 'Employee Appreciation', 13)
ON CONFLICT (key) DO NOTHING;

-- Seed permission matrix rows for all roles
INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, 'employeeAppreciation', p.key, FALSE, FALSE
FROM roles r CROSS JOIN permissions p
ON CONFLICT (role_id, module_key, permission_key) DO NOTHING;

-- Default grants: allow view, create, update, delete for all active roles
UPDATE role_permissions rp
SET is_allowed = TRUE
FROM roles r
WHERE rp.role_id = r.id
  AND rp.module_key = 'employeeAppreciation';
