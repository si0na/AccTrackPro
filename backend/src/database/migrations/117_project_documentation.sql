-- Migration 117: Add project_documentation table
CREATE TABLE IF NOT EXISTS project_documentation (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('URL', 'FILE')),
  url             TEXT,
  file_name       TEXT,
  file_path       TEXT,
  file_size       BIGINT,
  mime_type       TEXT,
  description     TEXT NOT NULL DEFAULT '',
  created_by_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proj_doc_project ON project_documentation(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_doc_created ON project_documentation(created_at DESC);
