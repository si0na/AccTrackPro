-- Import / Export audit trail.
--
-- Records every bulk import and export action across the CRM modules so
-- administrators can review who moved data in or out, when, in what format,
-- and with what outcome. This is a dedicated audit table (distinct from the
-- append-only `activities` feed) that captures per-run record counts and a
-- success/partial/failed status.
--
-- Scoped per user via user_id (the JWT sub of the actor). Append-only — rows
-- are never updated or soft-deleted.

CREATE TABLE IF NOT EXISTS import_export_audit (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id          TEXT,
  user_name        TEXT,
  module           TEXT NOT NULL,              -- 'accounts' | 'opportunities' | 'stakeholders' | 'actionItems'
  action           TEXT NOT NULL,              -- 'import' | 'export'
  file_format      TEXT,                       -- 'xlsx' | 'csv' | NULL
  total_records    INTEGER NOT NULL DEFAULT 0,
  created_records  INTEGER NOT NULL DEFAULT 0,
  updated_records  INTEGER NOT NULL DEFAULT 0,
  skipped_records  INTEGER NOT NULL DEFAULT 0,
  failed_records   INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL,              -- 'success' | 'partial' | 'failed'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iea_user    ON import_export_audit (user_id);
CREATE INDEX IF NOT EXISTS idx_iea_created ON import_export_audit (created_at DESC);
