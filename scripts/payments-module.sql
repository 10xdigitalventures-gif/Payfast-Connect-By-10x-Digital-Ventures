-- ═══════════════════════════════════════════════════════
-- GoPayFast CRM — Full Payments Module Schema
-- Run in phpMyAdmin after existing setup.sql
-- ═══════════════════════════════════════════════════════

USE payfast_ghl;

-- ─── Products / Services Catalog ──────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  location_id   VARCHAR(100) NOT NULL,
  name          VARCHAR(300) NOT NULL,
  description   TEXT,
  price         DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency      VARCHAR(10) DEFAULT 'PKR',
  type          ENUM('one_time','recurring','free') DEFAULT 'one_time',
  interval      ENUM('monthly','quarterly','annual') DEFAULT 'monthly',
  image_url     VARCHAR(500),
  sku           VARCHAR(100),
  is_active     TINYINT(1) DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_loc (location_id)
);

-- ─── Coupons / Discount Codes ─────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL,
  code            VARCHAR(50) NOT NULL,
  name            VARCHAR(200),
  type            ENUM('percent','fixed') DEFAULT 'percent',
  value           DECIMAL(10,2) NOT NULL,
  min_amount      DECIMAL(10,2) DEFAULT 0,
  max_uses        INT DEFAULT 0,
  uses_count      INT DEFAULT 0,
  expires_at      DATETIME,
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_code (location_id, code),
  INDEX idx_loc (location_id)
);

-- ─── Invoices ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL,
  invoice_number  VARCHAR(50) NOT NULL,
  token           VARCHAR(64) NOT NULL UNIQUE,   -- public pay link token
  -- Contact info
  contact_id      VARCHAR(100),
  client_name     VARCHAR(200) NOT NULL,
  client_email    VARCHAR(255) NOT NULL,
  client_phone    VARCHAR(50),
  client_address  TEXT,
  -- Invoice details
  title           VARCHAR(300) DEFAULT 'Invoice',
  notes           TEXT,
  terms           TEXT,
  issue_date      DATE NOT NULL,
  due_date        DATE,
  -- Amounts
  subtotal        DECIMAL(12,2) DEFAULT 0,
  discount_type   ENUM('percent','fixed') DEFAULT 'percent',
  discount_value  DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_rate        DECIMAL(5,2) DEFAULT 0,
  tax_amount      DECIMAL(12,2) DEFAULT 0,
  total           DECIMAL(12,2) DEFAULT 0,
  -- Coupon
  coupon_id       INT,
  coupon_code     VARCHAR(50),
  -- Mode: simple vs line_items
  mode            ENUM('simple','line_items') DEFAULT 'line_items',
  -- Status
  status          ENUM('draft','sent','viewed','paid','overdue','cancelled') DEFAULT 'draft',
  paid_at         DATETIME,
  pf_payment_id   VARCHAR(100),
  -- CRM sync
  synced_ghl      TINYINT(1) DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_loc    (location_id),
  INDEX idx_token  (token),
  INDEX idx_status (status)
);

-- ─── Invoice Line Items ───────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id  INT NOT NULL,
  product_id  INT,
  name        VARCHAR(300) NOT NULL,
  description TEXT,
  quantity    DECIMAL(10,2) DEFAULT 1,
  unit_price  DECIMAL(12,2) NOT NULL,
  total       DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX idx_inv (invoice_id)
);

-- ─── Payment Links (Stripe-style) ─────────────────────
CREATE TABLE IF NOT EXISTS payment_links (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  location_id   VARCHAR(100) NOT NULL,
  token         VARCHAR(64) NOT NULL UNIQUE,
  name          VARCHAR(300) NOT NULL,
  description   TEXT,
  product_id    INT,
  amount        DECIMAL(12,2),
  amount_type   ENUM('fixed','custom') DEFAULT 'fixed',
  currency      VARCHAR(10) DEFAULT 'PKR',
  type          ENUM('one_time','subscription') DEFAULT 'one_time',
  interval      ENUM('monthly','quarterly','annual') DEFAULT 'monthly',
  -- Limits
  max_uses      INT DEFAULT 0,
  uses_count    INT DEFAULT 0,
  expires_at    DATETIME,
  -- Options
  collect_phone     TINYINT(1) DEFAULT 0,
  collect_address   TINYINT(1) DEFAULT 0,
  allow_coupon      TINYINT(1) DEFAULT 1,
  success_redirect  VARCHAR(500),
  -- CRM auto-tags
  tag_on_pay    VARCHAR(500),
  ghl_pipeline  VARCHAR(100),
  -- QR code (stored as data url or path)
  qr_code       TEXT,
  is_active     TINYINT(1) DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_loc   (location_id),
  INDEX idx_token (token)
);

-- ─── Text2Pay (SMS Payment Requests) ─────────────────
CREATE TABLE IF NOT EXISTS text2pay (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  location_id   VARCHAR(100) NOT NULL,
  contact_id    VARCHAR(100),
  contact_name  VARCHAR(200),
  phone         VARCHAR(50) NOT NULL,
  email         VARCHAR(255),
  amount        DECIMAL(12,2) NOT NULL,
  description   VARCHAR(500),
  token         VARCHAR(64) NOT NULL UNIQUE,
  status        ENUM('sent','viewed','paid','expired') DEFAULT 'sent',
  expires_at    DATETIME,
  paid_at       DATETIME,
  pf_payment_id VARCHAR(100),
  sms_sid       VARCHAR(200),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_loc (location_id)
);

-- ─── Order Forms ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_forms (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) NOT NULL,
  token           VARCHAR(64) NOT NULL UNIQUE,
  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  product_id      INT,
  amount          DECIMAL(12,2),
  currency        VARCHAR(10) DEFAULT 'PKR',
  type            ENUM('one_time','subscription') DEFAULT 'one_time',
  -- Fields to collect
  collect_name    TINYINT(1) DEFAULT 1,
  collect_email   TINYINT(1) DEFAULT 1,
  collect_phone   TINYINT(1) DEFAULT 1,
  collect_address TINYINT(1) DEFAULT 0,
  custom_fields   JSON,
  -- Appearance
  button_text     VARCHAR(100) DEFAULT 'Pay Now',
  success_message TEXT,
  success_redirect VARCHAR(500),
  -- CRM
  tag_on_pay      VARCHAR(500),
  pipeline_stage  VARCHAR(100),
  allow_coupon    TINYINT(1) DEFAULT 1,
  is_active       TINYINT(1) DEFAULT 1,
  submissions     INT DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_slug (location_id, slug),
  INDEX idx_loc   (location_id),
  INDEX idx_token (token)
);

-- ─── Payment Schedules (Installments) ─────────────────
CREATE TABLE IF NOT EXISTS payment_schedules (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL,
  contact_id      VARCHAR(100),
  client_name     VARCHAR(200) NOT NULL,
  client_email    VARCHAR(255) NOT NULL,
  total_amount    DECIMAL(12,2) NOT NULL,
  installments    INT NOT NULL DEFAULT 2,
  paid_count      INT DEFAULT 0,
  amount_paid     DECIMAL(12,2) DEFAULT 0,
  description     VARCHAR(500),
  status          ENUM('active','completed','cancelled') DEFAULT 'active',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_loc   (location_id)
);

CREATE TABLE IF NOT EXISTS schedule_installments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id     INT NOT NULL,
  installment_num INT NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  due_date        DATE,
  token           VARCHAR(64) UNIQUE,
  status          ENUM('pending','sent','paid','overdue') DEFAULT 'pending',
  paid_at         DATETIME,
  pf_payment_id   VARCHAR(100),
  FOREIGN KEY (schedule_id) REFERENCES payment_schedules(id) ON DELETE CASCADE
);
