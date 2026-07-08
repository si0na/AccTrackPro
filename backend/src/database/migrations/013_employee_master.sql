-- Employee Master: authorized employee email addresses for registration
CREATE TABLE IF NOT EXISTS employee_master (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_master_email ON employee_master(LOWER(email));

-- Seed authorized employees
INSERT INTO employee_master (email) VALUES
  ('rajakrishnan.s@reflectionsinfos.com'),
  ('gayathri.hn@reflectionsinfos.com'),
  ('syam.kr@reflectionsinfos.com'),
  ('siona.thomas@reflectionsinfos.com'),
  ('manoj.alencherry@reflectionsinfos.com')
ON CONFLICT (email) DO NOTHING;

-- NOTE: this migration must never delete rows from users. Enforcement of the
-- employee whitelist happens at registration time (AuthService.register);
-- existing accounts are managed explicitly via the Admin UI, not by DDL.
-- Known development seed users are removed by 014_remove_dev_seed_users.sql.
