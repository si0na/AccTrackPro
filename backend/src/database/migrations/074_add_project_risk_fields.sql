-- Adds RAG, Impact Description, Classification, Contingency Plan, and Risk Open Date to project_risks table.

ALTER TABLE project_risks ADD COLUMN IF NOT EXISTS rag TEXT;
ALTER TABLE project_risks ADD COLUMN IF NOT EXISTS impact_description TEXT;
ALTER TABLE project_risks ADD COLUMN IF NOT EXISTS classification TEXT;
ALTER TABLE project_risks ADD COLUMN IF NOT EXISTS contingency_plan TEXT;
ALTER TABLE project_risks ADD COLUMN IF NOT EXISTS risk_open_date DATE;

DO $pr_rag$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pr_rag') THEN
    ALTER TABLE project_risks ADD CONSTRAINT chk_pr_rag
      CHECK (rag IS NULL OR rag IN ('Red', 'Amber', 'Green'));
  END IF;
END $pr_rag$;

DO $pr_classification$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pr_classification') THEN
    ALTER TABLE project_risks ADD CONSTRAINT chk_pr_classification
      CHECK (classification IS NULL OR classification IN ('Cost', 'Resource', 'Schedule', 'Operational', 'Technical', 'Environment', 'Quality', 'Scope', 'Others'));
  END IF;
END $pr_classification$;
