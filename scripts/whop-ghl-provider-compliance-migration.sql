-- GoPayFast + Whop / HighLevel custom-provider compliance migration
-- Run this ONCE in the same production database used by the application.
-- MySQL 8+ required (ADD COLUMN IF NOT EXISTS).

-- 1) Scope every saved payment method to a HighLevel contact and gateway identity.
ALTER TABLE payment_instruments
  ADD COLUMN IF NOT EXISTS contact_id VARCHAR(100) NULL AFTER location_id,
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'payfast' AFTER contact_id,
  ADD COLUMN IF NOT EXISTS provider_customer_id VARCHAR(120) NULL AFTER provider,
  ADD COLUMN IF NOT EXISTS provider_payment_method_id VARCHAR(120) NULL AFTER provider_customer_id;

CREATE INDEX IF NOT EXISTS idx_payment_instruments_contact
  ON payment_instruments (location_id, contact_id, provider);
CREATE INDEX IF NOT EXISTS idx_payment_instruments_provider_method
  ON payment_instruments (location_id, contact_id, provider, provider_payment_method_id);

-- Existing instruments predate contact mapping. They deliberately remain contact_id=NULL
-- and are never returned by the HighLevel list_payment_methods endpoint.
UPDATE payment_instruments
SET provider = 'payfast'
WHERE provider IS NULL OR provider = '';

-- 2) Persist HighLevel and Whop subscription linkage for checkout-based subscriptions.
CREATE TABLE IF NOT EXISTS ghl_provider_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_id VARCHAR(100) NOT NULL,
  contact_id VARCHAR(100) NULL,
  ghl_subscription_id VARCHAR(120) NULL,
  ghl_transaction_id VARCHAR(120) NULL,
  provider VARCHAR(20) NOT NULL DEFAULT 'whop',
  provider_customer_id VARCHAR(120) NULL,
  provider_payment_method_id VARCHAR(120) NULL,
  provider_membership_id VARCHAR(120) NULL,
  provider_plan_id VARCHAR(120) NULL,
  payment_id INT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  interval_unit VARCHAR(20) NOT NULL DEFAULT 'month',
  interval_count INT NOT NULL DEFAULT 1,
  next_charge_at DATETIME NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ghl_provider_subscription (location_id, ghl_subscription_id),
  KEY idx_ghl_provider_subscription_txn (location_id, ghl_transaction_id),
  KEY idx_ghl_provider_subscription_member (provider_membership_id),
  KEY idx_ghl_provider_subscription_contact (location_id, contact_id, status)
);

-- 3) Keep an immutable refund ledger. This is required for multiple partial refunds.
CREATE TABLE IF NOT EXISTS payment_refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  location_id VARCHAR(100) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  provider_refund_id VARCHAR(160) NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'succeeded',
  raw_response JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payment_refunds_payment (payment_id, status),
  KEY idx_payment_refunds_provider_refund (provider_refund_id)
);

-- 4) Helpful lookups used by verify/refund/webhook handlers.
CREATE INDEX IF NOT EXISTS idx_payments_ghl_verify
  ON payments (location_id, custom_str3, pf_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_contact_provider
  ON payments (location_id, contact_id, provider, status);
