-- Migration 108: Add system-generated action_item_number to action_items table.

-- 1. Add action_item_number column
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS action_item_number TEXT;

-- 2. Create sequence tracking table per account prefix
CREATE TABLE IF NOT EXISTS action_item_sequences (
  prefix   TEXT    PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

-- 3. Backfill existing action_items ordered by created_at ASC, id ASC
WITH pref_items AS (
  SELECT
    ai.id,
    CASE
      WHEN LENGTH(UPPER(REGEXP_REPLACE(a.name, '[^A-Za-z]', '', 'g'))) >= 3
        THEN SUBSTRING(UPPER(REGEXP_REPLACE(a.name, '[^A-Za-z]', '', 'g')) FROM 1 FOR 3)
      ELSE
        RPAD(UPPER(REGEXP_REPLACE(a.name, '[^A-Za-z]', '', 'g')), 3, 'X')
    END AS prefix,
    ai.created_at
  FROM action_items ai
  JOIN accounts a ON ai.account_id = a.id
),
numbered_items AS (
  SELECT
    p.id,
    p.prefix,
    ROW_NUMBER() OVER (
      PARTITION BY p.prefix
      ORDER BY p.created_at ASC, p.id ASC
    ) AS seq_num
  FROM pref_items p
)
UPDATE action_items ai
SET action_item_number = n.prefix || '-' || LPAD(n.seq_num::TEXT, 4, '0')
FROM numbered_items n
WHERE ai.id = n.id AND (ai.action_item_number IS NULL OR ai.action_item_number = '');

-- 4. Initialize action_item_sequences counters from backfilled data
INSERT INTO action_item_sequences (prefix, last_seq)
SELECT
  SUBSTRING(action_item_number FROM 1 FOR 3) AS prefix,
  MAX(CAST(SUBSTRING(action_item_number FROM 5) AS INTEGER)) AS last_seq
FROM action_items
WHERE action_item_number IS NOT NULL AND action_item_number LIKE '___-%'
GROUP BY SUBSTRING(action_item_number FROM 1 FOR 3)
ON CONFLICT (prefix) DO UPDATE SET last_seq = EXCLUDED.last_seq;

-- 5. Add unique index on action_item_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_action_item_number ON action_items(action_item_number);
