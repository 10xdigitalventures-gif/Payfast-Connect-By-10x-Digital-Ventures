-- Run after scripts/agency-billing.sql and scripts/agency-whop-billing.sql.
-- Existing merchant_* columns remain the PayFast LIVE credentials.
ALTER TABLE agency_settings
  ADD COLUMN IF NOT EXISTS sandbox_merchant_id VARCHAR(100) NULL AFTER environment,
  ADD COLUMN IF NOT EXISTS sandbox_merchant_key VARCHAR(255) NULL AFTER sandbox_merchant_id,
  ADD COLUMN IF NOT EXISTS sandbox_merchant_name VARCHAR(200) NULL AFTER sandbox_merchant_key,
  ADD COLUMN IF NOT EXISTS sandbox_store_id VARCHAR(100) NULL AFTER sandbox_merchant_name,
  ADD COLUMN IF NOT EXISTS sandbox_passphrase VARCHAR(255) NULL AFTER sandbox_store_id,
  ADD COLUMN IF NOT EXISTS swich_live_client_id VARCHAR(150) NULL AFTER sandbox_passphrase,
  ADD COLUMN IF NOT EXISTS swich_live_secret_key VARCHAR(255) NULL AFTER swich_live_client_id,
  ADD COLUMN IF NOT EXISTS swich_live_checkout_url VARCHAR(1000) NULL AFTER swich_live_secret_key,
  ADD COLUMN IF NOT EXISTS swich_sandbox_client_id VARCHAR(150) NULL AFTER swich_live_checkout_url,
  ADD COLUMN IF NOT EXISTS swich_sandbox_secret_key VARCHAR(255) NULL AFTER swich_sandbox_client_id,
  ADD COLUMN IF NOT EXISTS swich_sandbox_checkout_url VARCHAR(1000) NULL AFTER swich_sandbox_secret_key;

ALTER TABLE billing_invoices
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'payfast' AFTER payment_id;

SELECT 'Agency gateway environments installed' AS status;
