-- Migration 088: Employee Rewards and Recognition Module
-- Create table for Employee Rewards and Recognition under Employee Engagement section

CREATE TABLE IF NOT EXISTS employee_rewards_recognition (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  month_of_rr TEXT NOT NULL,
  nominated_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  nominated_by_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Continous', 'Quarterly', 'Annual')),
  category TEXT NOT NULL,
  team_or_individual TEXT NOT NULL CHECK (team_or_individual IN ('Individual', 'Team')),
  employee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  employee_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('Nominated - Not Won', 'Won', 'Nomination Rejected')),
  details TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_rr_month ON employee_rewards_recognition(month_of_rr) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employee_rr_type ON employee_rewards_recognition(type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employee_rr_status ON employee_rewards_recognition(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employee_rr_employee ON employee_rewards_recognition(employee_id) WHERE is_deleted = FALSE;

-- Register module in RBAC
INSERT INTO modules (key, name, sort_order) VALUES ('employeeRewardsRecognition', 'Employee Rewards and Recognition', 14)
ON CONFLICT (key) DO NOTHING;

-- Seed permission matrix rows for all roles
INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, 'employeeRewardsRecognition', p.key, FALSE, FALSE
FROM roles r CROSS JOIN permissions p
ON CONFLICT (role_id, module_key, permission_key) DO NOTHING;

-- Default grants: allow view, create, update, delete for all active roles
UPDATE role_permissions rp
SET is_allowed = TRUE
FROM roles r
WHERE rp.role_id = r.id
  AND rp.module_key = 'employeeRewardsRecognition';
