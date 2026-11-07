-- GoPayFast + Whop / HighLevel custom-provider compliance migration
-- MySQL 8.0 compatible and safe to run repeatedly. No unsupported
-- ADD COLUMN IF NOT EXISTS or CREATE INDEX IF NOT EXISTS syntax.
-- Run against the intended database (metadata queries use DATABASE()).

-- 1) Scope saved payment methods to a HighLevel contact and gateway identity.
-- Idempotent column: payment_instruments.contact_id
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_instruments' AND COLUMN_NAME='contact_id'),
  'DO 0',
  'ALTER TABLE payment_instruments ADD COLUMN contact_id VARCHAR(100) NULL AFTER location_id'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Idempotent column: payment_instruments.provider
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_instruments' AND COLUMN_NAME='provider'),
  'DO 0',
  'ALTER TABLE payment_instruments ADD COLUMN provider VARCHAR(20) NOT NULL DEFAULT ''payfast'' AFTER contact_id'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Idempotent column: payment_instruments.provider_customer_id
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_instruments' AND COLUMN_NAME='provider_customer_id'),
  'DO 0',
  'ALTER TABLE payment_instruments ADD COLUMN provider_customer_id VARCHAR(120) NULL AFTER provider'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Idempotent column: payment_instruments.provider_payment_method_id
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_instruments' AND COLUMN_NAME='provider_payment_method_id'),
  'DO 0',
  'ALTER TABLE payment_instruments ADD COLUMN provider_payment_method_id VARCHAR(120) NULL AFTER provider_customer_id'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Idempotent index: payment_instruments.idx_payment_instruments_contact
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_instruments' AND INDEX_NAME='idx_payment_instruments_contact'),
  'DO 0',
  'CREATE INDEX idx_payment_instruments_contact ON payment_instruments (location_id,contact_id,provider)'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Idempotent index: payment_instruments.idx_payment_instruments_provider_method
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_instruments' AND INDEX_NAME='idx_payment_instruments_provider_method'),
  'DO 0',
  'CREATE INDEX idx_payment_instruments_provider_method ON payment_instruments (location_id,contact_id,provider,provider_payment_method_id)'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Existing instruments predate contact mapping and remain contact_id=NULL;
-- they are not eligible for list_payment_methods.
UPDATE payment_instruments SET provider='payfast'
WHERE provider IS NULL OR provider='';

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
-- Idempotent index: payments.idx_payments_ghl_verify
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payments' AND INDEX_NAME='idx_payments_ghl_verify'),
  'DO 0',
  'CREATE INDEX idx_payments_ghl_verify ON payments (location_id,custom_str3,pf_payment_id)'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Idempotent index: payments.idx_payments_contact_provider
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payments' AND INDEX_NAME='idx_payments_contact_provider'),
  'DO 0',
  'CREATE INDEX idx_payments_contact_provider ON payments (location_id,contact_id,provider,status)'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

