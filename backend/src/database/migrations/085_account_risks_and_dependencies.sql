-- Migration 085: Account Risks & Dependencies and Risks Module RBAC

CREATE TABLE IF NOT EXISTS account_risks (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id              TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  risk_type               TEXT NOT NULL DEFAULT 'Risk' CHECK (risk_type IN ('Risk', 'Dependency')),
  description             TEXT NOT NULL,
  priority                TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  rag                     TEXT CHECK (rag IS NULL OR rag IN ('Red', 'Amber', 'Green')),
  impact                  TEXT CHECK (impact IS NULL OR impact IN ('High', 'Medium', 'Low')),
  likelihood              TEXT CHECK (likelihood IS NULL OR likelihood IN ('High', 'Medium', 'Low')),
  severity                TEXT,
  owner_id                TEXT REFERENCES users(id) ON DELETE SET NULL,
  mitigation_plan         TEXT NOT NULL DEFAULT '',
  status                  TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Mitigated', 'Closed', 'Accepted')),
  target_resolution_date  DATE,
  is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_risks_account ON account_risks(account_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_account_risks_status ON account_risks(status) WHERE is_deleted = FALSE;

-- Register 'risks' module in RBAC
INSERT INTO modules (key, name, sort_order) VALUES ('risks', 'Risks', 14)
ON CONFLICT (key) DO NOTHING;

-- Seed permission matrix rows for all roles for 'risks' module
INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, 'risks', p.key, FALSE, FALSE
FROM roles r CROSS JOIN permissions p
ON CONFLICT (role_id, module_key, permission_key) DO NOTHING;

-- Default grants: allow view, create, update, delete for all active roles
UPDATE role_permissions rp
SET is_allowed = TRUE
FROM roles r
WHERE rp.role_id = r.id
  AND rp.module_key = 'risks';
