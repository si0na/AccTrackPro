-- Add key/value administration settings table with default fy_selector_count.

CREATE TABLE IF NOT EXISTS administration_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO administration_settings (key, value)
VALUES ('fy_selector_count', '5')
ON CONFLICT (key) DO NOTHING;
