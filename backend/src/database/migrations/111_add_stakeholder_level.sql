-- Add level to stakeholders as TEXT NOT NULL DEFAULT 'Level 3' with CHECK constraint
ALTER TABLE stakeholders
  ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'Level 3';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stakeholders_level'
  ) THEN
    ALTER TABLE stakeholders
      ADD CONSTRAINT chk_stakeholders_level
      CHECK (level IN ('Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6+'));
  END IF;
END $$;

UPDATE stakeholders
SET level = 'Level 3'
WHERE level IS NULL OR level NOT IN ('Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6+');
