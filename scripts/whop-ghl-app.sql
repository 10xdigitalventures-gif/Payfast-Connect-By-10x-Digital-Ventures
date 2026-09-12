CREATE TABLE IF NOT EXISTS whop_ghl_installations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  location_id VARCHAR(255) NOT NULL,
  company_id VARCHAR(255) NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  installed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_whop_ghl_location (location_id),
  KEY idx_whop_ghl_company (company_id),
  KEY idx_whop_ghl_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
