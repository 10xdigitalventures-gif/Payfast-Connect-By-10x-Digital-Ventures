-- Multi-tenant agency plan isolation
-- Adds company_id to agency_plans so each Whop-connected agency keeps its own
-- plan catalogue. Existing rows stay global (company_id IS NULL) and are visible
-- to all agencies until scoped rows exist.

ALTER TABLE agency_plans
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(100) NULL AFTER trial_days,
  ADD INDEX  IF NOT EXISTS idx_agency_plans_company (company_id);

-- Agency settings: allow per-company overrides in future
-- (currently single-row; no-op placeholder)
-- ALTER TABLE agency_settings
--   ADD COLUMN IF NOT EXISTS company_id VARCHAR(100) NULL;

-- To create a company-scoped plan:
-- INSERT INTO agency_plans (name, slug, price_monthly, price_yearly, max_locations, features, trial_days, company_id)
-- VALUES ('Pro', 'pro', 4999, 49990, 5, JSON_ARRAY('All Features'), 14, 'whop_company_XXX');
