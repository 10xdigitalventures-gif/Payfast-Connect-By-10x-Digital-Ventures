-- Whop plan <-> GHL SaaS plan mapping.
-- One stable Whop plan per (agency_plan_id x frequency x whop_company_id) so
-- repeated subscribes reuse the same Whop plan instead of minting a new plan
-- on every checkout. A new plan is minted only when the USD price changes.
--
-- Run once against the live DB (u564832781_payfast_ghl_2).

CREATE TABLE IF NOT EXISTS plan_whop_map (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  agency_plan_id      INT           NOT NULL,
  frequency           VARCHAR(20)   NOT NULL,        -- monthly | yearly
  whop_company_id     VARCHAR(100)  NOT NULL,
  whop_plan_id        VARCHAR(120)  NOT NULL,
  usd_amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  billing_period_days INT           NULL,
  trial_period_days   INT           NULL,
  created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_plan_freq_company (agency_plan_id, frequency, whop_company_id),
  INDEX idx_plan_whop_map_plan (agency_plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
