USE payfast_ghl;

CREATE TABLE IF NOT EXISTS agency_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  price_monthly DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(12,2) NOT NULL DEFAULT 0,
  max_locations INT NOT NULL DEFAULT 1,
  features JSON,
  is_active TINYINT(1) DEFAULT 1,
  trial_days INT DEFAULT 14,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS location_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_id VARCHAR(100) NOT NULL UNIQUE,
  plan_id INT NULL,
  status ENUM('trial','active','suspended','cancelled') DEFAULT 'trial',
  trial_ends_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  gopayfast_token VARCHAR(100) NULL,
  amount DECIMAL(12,2) DEFAULT 0,
  cancel_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_location_subscriptions_location (location_id),
  INDEX idx_location_subscriptions_status (status),
  CONSTRAINT fk_location_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES agency_plans(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_id VARCHAR(100) NOT NULL,
  plan_id INT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('paid','failed','pending') DEFAULT 'pending',
  payment_id VARCHAR(100) NULL,
  token VARCHAR(64) NULL,
  period_start DATETIME NULL,
  period_end DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_billing_invoices_location (location_id),
  INDEX idx_billing_invoices_status (status),
  CONSTRAINT fk_billing_invoices_plan FOREIGN KEY (plan_id) REFERENCES agency_plans(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS agency_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  merchant_id VARCHAR(100) NULL,
  merchant_key VARCHAR(255) NULL,
  merchant_name VARCHAR(200) NULL,
  store_id VARCHAR(100) NULL,
  passphrase VARCHAR(255) NULL,
  environment ENUM('live','sandbox') DEFAULT 'live',
  grace_period_days INT DEFAULT 3,
  trial_days INT DEFAULT 14,
  notify_email VARCHAR(255) NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_legal_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  terms_url VARCHAR(1000) NULL,
  privacy_policy_url VARCHAR(1000) NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO agency_settings (id, environment, grace_period_days, trial_days)
VALUES (1, 'live', 3, 14)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

INSERT INTO agency_legal_links (id)
VALUES (1)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

INSERT INTO agency_plans (name, slug, price_monthly, price_yearly, max_locations, features, trial_days)
VALUES
  ('Starter', 'starter', 2999, 29990, 1, JSON_ARRAY('Basic Payments', '1 Location'), 14),
  ('Growth', 'growth', 5999, 59990, 3, JSON_ARRAY('Basic Payments', 'Invoices', '3 Locations'), 14),
  ('Agency', 'agency', 11999, 119990, 10, JSON_ARRAY('All Features', '10 Locations'), 14),
  ('Enterprise', 'enterprise', 0, 0, 9999, JSON_ARRAY('White Label', 'Unlimited Locations', 'Custom Billing'), 30)
ON DUPLICATE KEY UPDATE
  price_monthly = VALUES(price_monthly),
  price_yearly = VALUES(price_yearly),
  max_locations = VALUES(max_locations),
  features = VALUES(features),
  trial_days = VALUES(trial_days),
  is_active = 1;
