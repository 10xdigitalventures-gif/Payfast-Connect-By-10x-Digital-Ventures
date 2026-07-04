-- ═══════════════════════════════════════════════════════
-- Whop payment provider — schema additions
-- Run in phpMyAdmin AFTER setup.sql
--
-- Adds Whop credentials to installations and provider-tracking columns to
-- payments so a single GHL location can offer BOTH GoPayFast and Whop.
-- ═══════════════════════════════════════════════════════

USE payfast_ghl;

-- ─── Whop credentials (per GHL sub-account) ───────────────────
ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS whop_enabled        TINYINT(1)     DEFAULT 0        AFTER environment,
  ADD COLUMN IF NOT EXISTS whop_api_key        VARCHAR(255)   NULL             AFTER whop_enabled,
  ADD COLUMN IF NOT EXISTS whop_company_id     VARCHAR(100)   NULL             AFTER whop_api_key,
  ADD COLUMN IF NOT EXISTS whop_webhook_secret VARCHAR(255)   NULL             AFTER whop_company_id,
  ADD COLUMN IF NOT EXISTS whop_exchange_rate  DECIMAL(10,4)  DEFAULT 280.0000 AFTER whop_webhook_secret,
  ADD COLUMN IF NOT EXISTS whop_fee_percent    DECIMAL(6,2)   DEFAULT 0.00     AFTER whop_exchange_rate,
  ADD COLUMN IF NOT EXISTS whop_rate_mode      VARCHAR(10)    DEFAULT 'fixed'   AFTER whop_fee_percent,
  ADD COLUMN IF NOT EXISTS whop_currency       VARCHAR(10)    DEFAULT 'PKR'     AFTER whop_rate_mode,
  ADD COLUMN IF NOT EXISTS route_oneoff        VARCHAR(20)    DEFAULT 'payfast' AFTER whop_currency,
  ADD COLUMN IF NOT EXISTS route_subscription  VARCHAR(20)    DEFAULT 'whop'    AFTER route_oneoff;

-- ─── Payment provider tracking ────────────────────────────────
-- custom_str3 already used by the CRM flow (kept here for fresh installs).
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS custom_str3      VARCHAR(255) NULL AFTER custom_str2,
  ADD COLUMN IF NOT EXISTS provider         VARCHAR(20)  DEFAULT 'payfast' AFTER payment_type,
  ADD COLUMN IF NOT EXISTS whop_plan_id     VARCHAR(120) NULL AFTER provider,
  ADD COLUMN IF NOT EXISTS whop_checkout_id   VARCHAR(120) NULL AFTER whop_plan_id,
  ADD COLUMN IF NOT EXISTS whop_membership_id VARCHAR(120) NULL AFTER whop_checkout_id;

CREATE INDEX IF NOT EXISTS idx_provider ON payments (provider);
