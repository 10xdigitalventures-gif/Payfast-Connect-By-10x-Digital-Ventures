-- ═══════════════════════════════════════════════════════
-- Agency SaaS billing — Whop provider additions
-- Run in phpMyAdmin AFTER agency-billing.sql
--
-- Lets agency-level SaaS billing charge clients via EITHER GoPayFast OR Whop
-- (routing toggle). Adds the agency's own Whop credentials to agency_settings
-- and per-subscription provider + Whop identifiers to location_subscriptions.
-- ═══════════════════════════════════════════════════════

-- ─── Agency-level Whop credentials + subscription routing ─────
ALTER TABLE agency_settings
  ADD COLUMN IF NOT EXISTS whop_api_key        VARCHAR(255)  NULL             AFTER notify_email,
  ADD COLUMN IF NOT EXISTS whop_company_id     VARCHAR(100)  NULL             AFTER whop_api_key,
  ADD COLUMN IF NOT EXISTS whop_webhook_secret VARCHAR(255)  NULL             AFTER whop_company_id,
  ADD COLUMN IF NOT EXISTS whop_exchange_rate  DECIMAL(10,4) DEFAULT 280.0000 AFTER whop_webhook_secret,
  ADD COLUMN IF NOT EXISTS whop_fee_percent    DECIMAL(6,2)  DEFAULT 0.00     AFTER whop_exchange_rate,
  ADD COLUMN IF NOT EXISTS whop_rate_mode      VARCHAR(10)   DEFAULT 'fixed'  AFTER whop_fee_percent,
  ADD COLUMN IF NOT EXISTS whop_currency       VARCHAR(10)   DEFAULT 'PKR'    AFTER whop_rate_mode,
  ADD COLUMN IF NOT EXISTS route_subscription  VARCHAR(20)   DEFAULT 'payfast' AFTER whop_currency;

-- ─── Per-subscription provider + Whop recurring identifiers ───
ALTER TABLE location_subscriptions
  ADD COLUMN IF NOT EXISTS provider              VARCHAR(20)  DEFAULT 'payfast' AFTER plan_id,
  ADD COLUMN IF NOT EXISTS recurring_token       VARCHAR(100) NULL AFTER gopayfast_token,
  ADD COLUMN IF NOT EXISTS whop_member_id        VARCHAR(120) NULL AFTER recurring_token,
  ADD COLUMN IF NOT EXISTS whop_payment_method_id VARCHAR(120) NULL AFTER whop_member_id,
  ADD COLUMN IF NOT EXISTS whop_membership_id    VARCHAR(120) NULL AFTER whop_payment_method_id,
  ADD COLUMN IF NOT EXISTS payer_email           VARCHAR(255) NULL AFTER whop_membership_id;

CREATE INDEX IF NOT EXISTS idx_location_subscriptions_provider ON location_subscriptions (provider);
