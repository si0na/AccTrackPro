-- Migration 118: Generate NPS responses for projects without opportunities and backfill existing projects missing NPS

INSERT INTO nps_responses (
  id,
  account_id,
  project_id,
  respondent_name,
  received_month_year,
  quarter,
  nps_score,
  liked_most,
  improvement_suggestions
)
SELECT
  gen_random_uuid()::TEXT,
  p.account_id,
  p.id AS project_id,
  COALESCE(
    (
      SELECT s.name || CASE WHEN s.designation IS NOT NULL AND s.designation <> '' THEN ' (' || s.designation || ')' ELSE '' END
      FROM stakeholders s
      WHERE s.account_id = p.account_id AND (s.stakeholder_type = 'CLIENT' OR s.stakeholder_type IS NULL) AND s.is_deleted = FALSE
      ORDER BY s.created_at ASC
      LIMIT 1
    ),
    NULLIF(p.client_pm_name, ''),
    'Sarah Jenkins (VP of Technology)'
  ) AS respondent_name,
  TO_CHAR(NOW(), 'YYYY-MM') AS received_month_year,
  CASE
    WHEN EXTRACT(MONTH FROM NOW()) BETWEEN 4 AND 6 THEN 'Q1'
    WHEN EXTRACT(MONTH FROM NOW()) BETWEEN 7 AND 9 THEN 'Q2'
    WHEN EXTRACT(MONTH FROM NOW()) BETWEEN 10 AND 12 THEN 'Q3'
    ELSE 'Q4'
  END AS quarter,
  9 AS nps_score,
  'Proactive communication, deep technical domain knowledge, and transparent weekly progress reporting.' AS liked_most,
  'Accelerate onboarding for new team members during scaling phases.' AS improvement_suggestions
FROM projects p
INNER JOIN accounts a ON p.account_id = a.id AND a.is_deleted = FALSE
WHERE p.is_deleted = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM nps_responses n WHERE n.project_id = p.id AND n.is_deleted = FALSE
  );
