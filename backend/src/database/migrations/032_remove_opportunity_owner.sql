-- Remove the free-text 'owner' display field — Owner is no longer a
-- first-class Opportunity attribute. Ownership/data-scoping continues via
-- owner_id (FK to users), which is untouched.
ALTER TABLE opportunities DROP COLUMN IF EXISTS owner;
