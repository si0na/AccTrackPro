-- Migration 103: Re-Implement Account Growth Module (Account + Financial Year Workspace)
-- Creates the 9 Account Growth schema tables and restores RBAC module/permission entries

-- 1. Digital / Tech Priorities
CREATE TABLE IF NOT EXISTS account_growth_client_priorities (
  id                          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id                  TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  financial_year_id           TEXT        NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  digital_tech_priorities     TEXT        NOT NULL,
  potential_services_involved TEXT,
  customer_maturity           TEXT        CHECK (customer_maturity IN ('High', 'Medium', 'Low')),
  our_presence                TEXT        CHECK (our_presence IN ('Yes', 'No')),
  competitor_presence         TEXT,
  estimated_client_spend      NUMERIC(15,2),
  revenue_potential           NUMERIC(15,2),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Top Two Trends in Client Industry
CREATE TABLE IF NOT EXISTS account_growth_industry_trends (
  id                        TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id                TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  financial_year_id         TEXT        NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  industry_trend            TEXT        NOT NULL,
  client_impact             TEXT        CHECK (client_impact IN ('High', 'Medium', 'Low')),
  customer_maturity         TEXT        CHECK (customer_maturity IN ('High', 'Medium', 'Low')),
  our_capability_to_address TEXT,
  estimated_client_spend    NUMERIC(15,2),
  revenue_potential         NUMERIC(15,2),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Client Financial Information Snapshot (1 snapshot record per Account + FY)
CREATE TABLE IF NOT EXISTS account_growth_budget_positioning (
  id                                   TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id                           TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  financial_year_id                    TEXT        NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  client_revenue                       NUMERIC(15,2),
  it_budget_tam                        NUMERIC(15,2),
  inhouse_spend_sam                    NUMERIC(15,2),
  outsourcing_spend                    NUMERIC(15,2),
  reflections_wallet_share_prev_fy_pct NUMERIC(5,2),
  wallet_share_plan_current_fy_pct     NUMERIC(5,2),
  created_at                           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_account_growth_budget_pos UNIQUE (account_id, financial_year_id)
);

-- 4. Wallet Share Increase Plan (Multi-record collection)
CREATE TABLE IF NOT EXISTS account_growth_wallet_share_plans (
  id                    TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id            TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  financial_year_id     TEXT        NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  initiative_title      TEXT        NOT NULL,
  strategy_details      TEXT,
  target_revenue_impact NUMERIC(15,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Success Parameters Snapshot (6 seeded parameters per Account + FY)
CREATE TABLE IF NOT EXISTS account_growth_success_parameters (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id        TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  financial_year_id TEXT        NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  parameter_key     TEXT        NOT NULL,
  parameter_name    TEXT        NOT NULL,
  client_perception TEXT        NOT NULL CHECK (client_perception IN ('Expert', 'Good', 'Average', 'Weak')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_account_growth_success_param UNIQUE (account_id, financial_year_id, parameter_key)
);

-- 6. Outsourcing Split (Multi-record collection)
CREATE TABLE IF NOT EXISTS account_growth_outsourcing_splits (
  id                    TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id            TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  financial_year_id     TEXT        NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  business_division     TEXT        NOT NULL,
  outsourcing_spend_pct NUMERIC(5,2),
  presence              TEXT        CHECK (presence IN ('Y', 'N')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Knowing Ourselves (SWOT Multi-record collection)
CREATE TABLE IF NOT EXISTS account_growth_swot (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id        TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  financial_year_id TEXT        NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  category          TEXT        NOT NULL CHECK (category IN ('Strength', 'Weakness', 'Opportunity', 'Threat')),
  details           TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Knowing the Competitor (Multi-record collection)
CREATE TABLE IF NOT EXISTS account_growth_competitors (
  id                            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id                    TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  financial_year_id             TEXT        NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  competitor_name               TEXT        NOT NULL,
  areas_involved                TEXT,
  res_count                     INTEGER,
  relationship_status           TEXT,
  sponsor_from_client           TEXT,
  major_skills_provided         TEXT,
  reason_considering_competitor TEXT,
  reflections_presence          TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Action Plan - General (Multi-record collection)
CREATE TABLE IF NOT EXISTS account_growth_action_plans (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id       TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  financial_year_id TEXT       NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  category         TEXT        NOT NULL,
  action_planned   TEXT        NOT NULL,
  our_approach     TEXT,
  timeline         TEXT,
  expected_outcome TEXT,
  target_date      DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Restore RBAC module and permissions for accountGrowth
INSERT INTO modules (key, name, sort_order)
VALUES ('accountGrowth', 'Account Growth', 25)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
SELECT r.id, 'accountGrowth', p.key, FALSE, FALSE
FROM roles r
CROSS JOIN permissions p
ON CONFLICT (role_id, module_key, permission_key) DO NOTHING;

UPDATE role_permissions
SET is_allowed = TRUE
WHERE module_key = 'accountGrowth'
  AND permission_key IN ('view', 'view-all', 'create', 'update', 'delete', 'export');
