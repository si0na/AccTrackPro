-- Extend document management to opportunities. A document is attached either
-- to an account directly (opportunity_id IS NULL — the existing behaviour) or
-- to one of the account's opportunities (opportunity_id set; account_id still
-- carries the parent account so account-level cascade delete keeps working).

DO $doc_opp$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'opportunity_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN opportunity_id TEXT REFERENCES opportunities(id) ON DELETE CASCADE;
  END IF;
END $doc_opp$;

CREATE INDEX IF NOT EXISTS idx_doc_opportunity ON documents(opportunity_id) WHERE opportunity_id IS NOT NULL;
