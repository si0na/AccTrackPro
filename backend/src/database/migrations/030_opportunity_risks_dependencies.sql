-- Risks & Dependencies: free-text field capturing known risks or blocking
-- dependencies for an opportunity, alongside the existing description/next-step fields.

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS risks_and_dependencies TEXT NOT NULL DEFAULT '';
