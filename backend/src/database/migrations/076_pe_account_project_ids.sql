-- Migration 076: Add account_id and project_id to performance_evaluations
-- Enables relational linking to Accounts and Projects while preserving legacy text fields.

ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pe_account_id ON performance_evaluations(account_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_pe_project_id ON performance_evaluations(project_id) WHERE is_deleted = FALSE;

-- Backfill existing legacy evaluations by matching free-text account/project names
UPDATE performance_evaluations pe
SET account_id = a.id
FROM accounts a
WHERE pe.account_id IS NULL
  AND a.is_deleted = FALSE
  AND LOWER(TRIM(pe.account)) = LOWER(TRIM(a.name));

UPDATE performance_evaluations pe
SET project_id = p.id
FROM projects p
WHERE pe.project_id IS NULL
  AND p.is_deleted = FALSE
  AND LOWER(TRIM(pe.project)) = LOWER(TRIM(p.name));
