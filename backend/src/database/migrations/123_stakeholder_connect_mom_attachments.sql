-- Migration 116: Stakeholder Connect MoM Document Attachments
--
-- Persists metadata for supporting documents attached to a Stakeholder Connect's
-- Minutes of Meeting (MoM). Binary file contents are stored on disk under
-- UPLOAD_DIR/stakeholder-connects-mom/ using server-generated unique identifiers.
--
-- Soft-deleting a Stakeholder Connect leaves attachment rows and disk files intact
-- so restoring the meeting preserves its MoM attachments.
--
-- Reversible rollback:
--   DROP INDEX IF EXISTS idx_stk_conn_mom_att_connect_created;
--   DROP INDEX IF EXISTS idx_stk_conn_mom_att_connect;
--   DROP TABLE IF EXISTS stakeholder_connect_mom_attachments;
--   DELETE FROM schema_migrations WHERE version = '116';

CREATE TABLE IF NOT EXISTS stakeholder_connect_mom_attachments (
  id                TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  connect_id        TEXT         NOT NULL REFERENCES stakeholder_connects(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename   VARCHAR(255) NOT NULL UNIQUE,
  storage_path      TEXT         NOT NULL,
  mime_type         VARCHAR(150) NOT NULL,
  file_extension    VARCHAR(20)  NOT NULL,
  file_size         BIGINT       NOT NULL CHECK (file_size >= 0),
  uploaded_by       TEXT         REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stk_conn_mom_att_connect
  ON stakeholder_connect_mom_attachments(connect_id);

CREATE INDEX IF NOT EXISTS idx_stk_conn_mom_att_connect_created
  ON stakeholder_connect_mom_attachments(connect_id, uploaded_at DESC);

