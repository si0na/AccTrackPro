-- Migration 097: Remove Account Growth Module Schema & RBAC Permissions

-- 1. Drop all Account Growth tables safely with CASCADE
DROP TABLE IF EXISTS account_growth_client_priorities CASCADE;
DROP TABLE IF EXISTS account_growth_industry_trends CASCADE;
DROP TABLE IF EXISTS account_growth_success_parameters CASCADE;
DROP TABLE IF EXISTS account_growth_outsourcing_split CASCADE;
DROP TABLE IF EXISTS account_growth_swot CASCADE;
DROP TABLE IF EXISTS account_growth_competitors CASCADE;
DROP TABLE IF EXISTS account_growth_action_plans CASCADE;
DROP TABLE IF EXISTS account_growth_budget_positioning CASCADE;
DROP TABLE IF EXISTS account_growth_wallet_share_plans CASCADE;
DROP TABLE IF EXISTS account_growth_plans CASCADE;

-- 2. Remove role permissions associated with accountGrowth module
DELETE FROM role_permissions WHERE module_key = 'accountGrowth';

-- 3. Remove accountGrowth from modules table
DELETE FROM modules WHERE key = 'accountGrowth';
