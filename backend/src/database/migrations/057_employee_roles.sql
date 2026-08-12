-- pre-assigned roles for whitelisted employee master rows (multi-role support before registration)
CREATE TABLE IF NOT EXISTS employee_roles (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id TEXT NOT NULL REFERENCES employee_master(id) ON DELETE CASCADE,
  role_id     TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_roles_employee ON employee_roles(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_roles_role ON employee_roles(role_id);

-- Backfill existing single-role assignments
INSERT INTO employee_roles (employee_id, role_id)
SELECT id, role_id FROM employee_master WHERE role_id IS NOT NULL
ON CONFLICT (employee_id, role_id) DO NOTHING;
