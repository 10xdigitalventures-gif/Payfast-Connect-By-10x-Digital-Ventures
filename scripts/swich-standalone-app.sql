-- Standalone Swich GHL app installation and credential store.
CREATE TABLE IF NOT EXISTS swich_ghl_installations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  location_id VARCHAR(255) NOT NULL,
  company_id VARCHAR(255) NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  expires_at DATETIME NULL,
  environment ENUM('live','sandbox') NOT NULL DEFAULT 'sandbox',
  live_client_id VARCHAR(255) NULL,
  live_secret_key VARCHAR(255) NULL,
  live_checkout_url VARCHAR(1000) NULL,
  sandbox_client_id VARCHAR(255) NULL,
  sandbox_secret_key VARCHAR(255) NULL,
  sandbox_checkout_url VARCHAR(1000) NULL,
  provider_api_key VARCHAR(255) NULL,
  provider_publishable_key VARCHAR(255) NULL,
  installed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_swich_ghl_location (location_id),
  KEY idx_swich_ghl_company (company_id),
  KEY idx_swich_ghl_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
