-- Migration 099: Update constraints for Account Type (add 'Internal') and Tower (add 'Others')

-- 1. Account Type check constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('Strategic', 'Non Strategic', 'New', 'Internal'));

-- 2. Tower check constraint on accounts
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS chk_acc_tower;
ALTER TABLE accounts ADD CONSTRAINT chk_acc_tower
  CHECK (tower IS NULL OR tower IN ('Tower 1', 'Tower 2', 'Others'));

-- 3. Tower check constraint on opportunities
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_tower;
ALTER TABLE opportunities ADD CONSTRAINT chk_opp_tower
  CHECK (tower IS NULL OR tower IN ('Tower 1', 'Tower 2', 'Others'));

-- 4. Tower check constraint on projects
ALTER TABLE projects DROP CONSTRAINT IF EXISTS chk_proj_tower;
ALTER TABLE projects ADD CONSTRAINT chk_proj_tower
  CHECK (tower IS NULL OR tower IN ('Tower 1', 'Tower 2', 'Others'));
