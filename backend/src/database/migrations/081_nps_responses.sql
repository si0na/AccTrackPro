-- Migration 081: NPS Responses Table for Account & Project Detailed Views

CREATE TABLE IF NOT EXISTS nps_responses (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id              TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id              TEXT REFERENCES projects(id) ON DELETE CASCADE,
  respondent_id           TEXT REFERENCES stakeholders(id) ON DELETE SET NULL,
  respondent_name         TEXT,
  received_month_year     TEXT NOT NULL,
  quarter                 TEXT NOT NULL,
  nps_score               INTEGER NOT NULL CHECK (nps_score BETWEEN 0 AND 10),
  liked_most              TEXT NOT NULL DEFAULT '',
  improvement_suggestions TEXT NOT NULL DEFAULT '',
  is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nps_account ON nps_responses(account_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_nps_project ON nps_responses(project_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_nps_respondent ON nps_responses(respondent_id);

-- Seed representative sample NPS responses for accounts and projects
INSERT INTO nps_responses (account_id, project_id, respondent_name, received_month_year, quarter, nps_score, liked_most, improvement_suggestions)
SELECT
  a.id AS account_id,
  p.id AS project_id,
  'Sarah Jenkins (VP of Technology)' AS respondent_name,
  '2026-04' AS received_month_year,
  'Q1' AS quarter,
  9 AS nps_score,
  'Proactive communication, deep technical domain knowledge, and transparent weekly progress reporting.' AS liked_most,
  'Accelerate onboarding for new team members during scaling phases.' AS improvement_suggestions
FROM accounts a
LEFT JOIN projects p ON p.account_id = a.id AND p.is_deleted = FALSE
WHERE a.is_deleted = FALSE
LIMIT 2
ON CONFLICT (id) DO NOTHING;
