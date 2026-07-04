-- GoPayFast CRM Connect — Database Schema
-- Run this in cPanel phpMyAdmin or MySQL CLI

CREATE DATABASE IF NOT EXISTS payfast_ghl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE payfast_ghl;

-- ─── CRM Installations (one row per sub-account) ─────────────
CREATE TABLE IF NOT EXISTS installations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL UNIQUE,
  company_id      VARCHAR(100),
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  expires_at      DATETIME NOT NULL,
  -- GoPayFast credentials (set in Settings page after install)
  merchant_name   VARCHAR(200),
  store_id        VARCHAR(100),
  merchant_id     VARCHAR(50),
  merchant_key    VARCHAR(100),
  passphrase      VARCHAR(255),
  environment     ENUM('live','sandbox') DEFAULT 'live',
  -- CRM automation rules
  tag_on_payment  VARCHAR(500) DEFAULT 'paid,customer',
  tag_on_fail     VARCHAR(500) DEFAULT 'payment-failed',
  move_opp_stage  VARCHAR(100) DEFAULT 'won',
  auto_create_contact TINYINT(1) DEFAULT 1,
  fire_workflow   TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_location (location_id)
);

-- ─── Payments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL,
  pf_payment_id   VARCHAR(100),
  pf_token        VARCHAR(255),
  contact_id      VARCHAR(100),
  payer_email     VARCHAR(255),
  payer_first     VARCHAR(100),
  payer_last      VARCHAR(100),
  amount          DECIMAL(12,2) NOT NULL,
  item_name       VARCHAR(500),
  item_description VARCHAR(1000),
  payment_type    ENUM('one-time','subscription') DEFAULT 'one-time',
  status          ENUM('pending','complete','failed','cancelled') DEFAULT 'pending',
  synced_ghl      TINYINT(1) DEFAULT 0,
  custom_str1     VARCHAR(255),
  custom_str2     VARCHAR(255),
  raw_itn         JSON,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_location (location_id),
  INDEX idx_status (status),
  INDEX idx_pf_payment (pf_payment_id)
);

-- ─── Login Users ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL,
  username        VARCHAR(100) NOT NULL,
  password        VARCHAR(255) NOT NULL,
  role            ENUM('user','agency') DEFAULT 'user',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_location_id (location_id),
  INDEX idx_username (username),
  UNIQUE KEY uniq_location_id (location_id),
  UNIQUE KEY uniq_username (username)
);

CREATE TABLE IF NOT EXISTS installation_credentials (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL UNIQUE,
  username        VARCHAR(100) NOT NULL,
  password        VARCHAR(255) NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_location_id (location_id),
  INDEX idx_username (username)
);

-- ─── Subscriptions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL,
  contact_id      VARCHAR(100),
  pf_token        VARCHAR(255) UNIQUE NOT NULL,
  payer_email     VARCHAR(255),
  amount          DECIMAL(12,2),
  frequency       ENUM('monthly','quarterly','annual') DEFAULT 'monthly',
  status          ENUM('active','cancelled','paused') DEFAULT 'active',
  next_billing    DATE,
  cycles_count    INT DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_location (location_id),
  INDEX idx_token (pf_token)
);

-- ─── Merchant Applications (10x Aggregator Onboarding) ───────
CREATE TABLE IF NOT EXISTS merchant_applications (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  -- Status
  status              ENUM('pending','reviewing','approved','rejected','live') DEFAULT 'pending',
  -- Personal Details
  full_name           VARCHAR(200) NOT NULL,
  username            VARCHAR(100),
  id_number           VARCHAR(50),
  email               VARCHAR(255) NOT NULL,
  phone               VARCHAR(50) NOT NULL,
  -- Business Details
  business_name       VARCHAR(200) NOT NULL,
  business_type       ENUM('sole_proprietor','partnership','pty_ltd','cc','npo','trust','other') NOT NULL,
  registration_number VARCHAR(100),
  vat_number          VARCHAR(50),
  website             VARCHAR(500),
  business_category   VARCHAR(100),
  monthly_turnover    VARCHAR(50),
  business_description TEXT,
  -- Address
  address_line1       VARCHAR(255),
  address_line2       VARCHAR(255),
  city                VARCHAR(100),
  province            VARCHAR(100),
  postal_code         VARCHAR(20),
  country             VARCHAR(100) DEFAULT 'South Africa',
  -- Bank Details
  bank_name           VARCHAR(100),
  account_holder      VARCHAR(200),
  account_number      VARCHAR(100),
  account_type        ENUM('cheque','savings','transmission') DEFAULT 'cheque',
  branch_code         VARCHAR(20),
  -- CRM info (optional — link to their CRM sub-account)
  ghl_location_id     VARCHAR(100),
  integration_platform VARCHAR(100),
  -- GoPayFast credentials (filled by admin after account creation)
  pf_merchant_id      VARCHAR(50),
  pf_merchant_key     VARCHAR(100),
  pf_passphrase       VARCHAR(255),
  -- Admin notes
  admin_notes         TEXT,
  rejection_reason    TEXT,
  reviewed_by         VARCHAR(100),
  reviewed_at         DATETIME,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_email  (email)
);
