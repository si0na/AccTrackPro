-- Scope custom_columns and column_configs to individual users.
-- Each user maintains their own custom columns and column layout per module
-- instead of sharing a single global configuration.

ALTER TABLE custom_columns ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE column_configs ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Key uniqueness is now per user, not global.
ALTER TABLE custom_columns DROP CONSTRAINT IF EXISTS custom_columns_key_key;

DO $user_cols$ BEGIN
  -- Retire the legacy single-column PK (module) in favour of (user_id, module).
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'column_configs'::regclass AND contype = 'p'
      AND array_length(conkey, 1) = 1
  ) THEN
    ALTER TABLE column_configs DROP CONSTRAINT column_configs_pkey;
  END IF;

  -- One-time backfill: legacy global rows were visible to everyone, so give
  -- each existing user their own copy before per-user scoping takes effect.
  -- Keys are preserved so existing custom_data values keep rendering.
  IF NOT EXISTS (SELECT 1 FROM administration_settings WHERE key = 'user_scoped_columns_v1') THEN
    INSERT INTO custom_columns (id, user_id, module, key, name, type, created_at)
    SELECT gen_random_uuid()::TEXT, u.id, c.module, c.key, c.name, c.type, c.created_at
      FROM custom_columns c CROSS JOIN users u
     WHERE c.user_id IS NULL;
    INSERT INTO column_configs (user_id, module, config, updated_at)
    SELECT u.id, c.module, c.config, c.updated_at
      FROM column_configs c CROSS JOIN users u
     WHERE c.user_id IS NULL;
    INSERT INTO administration_settings (key, value) VALUES ('user_scoped_columns_v1', 'done');
  END IF;

  -- Ownerless rows are unreachable once scoping applies.
  DELETE FROM custom_columns WHERE user_id IS NULL;
  DELETE FROM column_configs WHERE user_id IS NULL;
  ALTER TABLE custom_columns ALTER COLUMN user_id SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'column_configs'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE column_configs ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE column_configs ADD PRIMARY KEY (user_id, module);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_custom_columns_user') THEN
    ALTER TABLE custom_columns ADD CONSTRAINT fk_custom_columns_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_column_configs_user') THEN
    ALTER TABLE column_configs ADD CONSTRAINT fk_column_configs_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $user_cols$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_user_key  ON custom_columns(user_id, key);
CREATE INDEX IF NOT EXISTS idx_cc_user_module     ON custom_columns(user_id, module);
