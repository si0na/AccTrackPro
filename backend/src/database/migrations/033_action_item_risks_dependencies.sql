-- Risks & Dependencies: free-text field capturing known risks or blocking
-- dependencies for an action item, mirroring the opportunities field (030).

ALTER TABLE action_items ADD COLUMN IF NOT EXISTS risks_and_dependencies TEXT NOT NULL DEFAULT '';
