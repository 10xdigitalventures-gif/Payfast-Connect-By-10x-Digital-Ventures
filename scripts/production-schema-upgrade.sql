-- Production schema upgrade for existing PayFast Connect installations.
-- Run this file in phpMyAdmin after selecting the application's database.
-- Do NOT run the legacy scripts/agency-billing.sql directly: it contains a
-- hard-coded USE payfast_ghl statement that may not match your production DB.

-- 1) Agency legal links used by agency settings and public billing pages.
CREATE TABLE IF NOT EXISTS agency_legal_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  terms_url VARCHAR(1000) NULL,
  privacy_policy_url VARCHAR(1000) NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO agency_legal_links (id)
VALUES (1)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 2) Company scoping for the agency plan catalogue.
ALTER TABLE agency_plans
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(100) NULL AFTER trial_days,
  ADD INDEX IF NOT EXISTS idx_agency_plans_company (company_id);

-- 3) Subscription grace-period state used by the suspension adapter.
ALTER TABLE location_subscriptions
  MODIFY status ENUM('trial','active','past_due','suspended','cancelled') DEFAULT 'trial';

ALTER TABLE location_subscriptions
  ADD COLUMN IF NOT EXISTS grace_until DATETIME NULL AFTER cancel_at,
  ADD COLUMN IF NOT EXISTS last_payment_at DATETIME NULL AFTER grace_until;

-- 4) Audit history for suspend, resume, and cancel attempts.
CREATE TABLE IF NOT EXISTS suspension_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_id VARCHAR(100) NOT NULL,
  company_id VARCHAR(100) NULL,
  action ENUM('suspend','resume','cancel') NOT NULL,
  strategy VARCHAR(40) NULL,
  reason VARCHAR(255) NULL,
  ghl_status VARCHAR(20) NULL,
  ghl_response TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_suspension_actions_location (location_id),
  INDEX idx_suspension_actions_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verification: each statement should return successfully before deploying.
SELECT 'Schema upgrade completed' AS status;
