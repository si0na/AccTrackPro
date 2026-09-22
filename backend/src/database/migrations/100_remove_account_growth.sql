-- Migration 100: Completely remove Account Growth module schema, tables, and RBAC permissions

DROP TABLE IF EXISTS account_growth_action_plans CASCADE;
DROP TABLE IF EXISTS account_growth_competitors CASCADE;
DROP TABLE IF EXISTS account_growth_swot_items CASCADE;
DROP TABLE IF EXISTS account_growth_swot CASCADE;
DROP TABLE IF EXISTS account_growth_outsourcing_splits CASCADE;
DROP TABLE IF EXISTS account_growth_outsourcing_split CASCADE;
DROP TABLE IF EXISTS account_growth_success_parameters CASCADE;
DROP TABLE IF EXISTS account_growth_industry_trends CASCADE;
DROP TABLE IF EXISTS account_growth_client_priorities CASCADE;
DROP TABLE IF EXISTS account_growth_wallet_share_plans CASCADE;
DROP TABLE IF EXISTS account_growth_financial_positioning CASCADE;
DROP TABLE IF EXISTS account_growth_budget_positioning CASCADE;
DROP TABLE IF EXISTS account_growth_plans CASCADE;

-- Remove RBAC permissions associated with accountGrowth
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions') THEN
    DELETE FROM role_permissions WHERE module_key = 'accountGrowth';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modules') THEN
    DELETE FROM modules WHERE key = 'accountGrowth';
  END IF;
END $$;
