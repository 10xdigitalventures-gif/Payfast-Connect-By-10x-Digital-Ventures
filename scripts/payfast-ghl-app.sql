-- Standalone PayFast GHL app installation and credential store.
-- Run once before enabling /oauth/payfast/callback in the Marketplace app.

CREATE TABLE IF NOT EXISTS payfast_ghl_installations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  location_id VARCHAR(255) NOT NULL,
  company_id VARCHAR(255) NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  expires_at DATETIME NULL,
  merchant_name VARCHAR(200) NULL,
  store_id VARCHAR(100) NULL,
  merchant_id VARCHAR(100) NULL,
  merchant_key VARCHAR(255) NULL,
  passphrase VARCHAR(255) NULL,
  environment ENUM('live','sandbox') NOT NULL DEFAULT 'sandbox',
  provider_api_key VARCHAR(255) NULL,
  provider_publishable_key VARCHAR(255) NULL,
  installed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payfast_ghl_location (location_id),
  KEY idx_payfast_ghl_company (company_id),
  KEY idx_payfast_ghl_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safe one-time migration for existing PayFast installations. Existing rows in
-- the standalone table win and are never overwritten.
INSERT IGNORE INTO payfast_ghl_installations
  (location_id, company_id, access_token, refresh_token, expires_at,
   merchant_name, store_id, merchant_id, merchant_key, passphrase, environment,
   provider_api_key, provider_publishable_key, installed_at, updated_at)
SELECT location_id, company_id, NULLIF(access_token, ''), NULLIF(refresh_token, ''), expires_at,
       merchant_name, store_id, merchant_id, merchant_key, passphrase,
       CASE WHEN environment='live' THEN 'live' ELSE 'sandbox' END,
       provider_api_key, provider_publishable_key, created_at, NOW()
  FROM installations
 WHERE merchant_id IS NOT NULL OR access_token IS NOT NULL;
