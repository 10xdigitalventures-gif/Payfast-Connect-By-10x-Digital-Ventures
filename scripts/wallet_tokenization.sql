-- ═══════════════════════════════════════════════════════
-- GoPayFast CRM — Wallet and Tokenization Extensions
-- ═══════════════════════════════════════════════════════

USE payfast_ghl;

-- ─── Wallet System ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL UNIQUE,
  balance         DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10) DEFAULT 'PKR',
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_loc (location_id)
);

-- ─── Payment Instruments (Saved Cards/Accounts) ──────────
CREATE TABLE IF NOT EXISTS payment_instruments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  location_id     VARCHAR(100) NOT NULL,
  instrument_token VARCHAR(255) NOT NULL,
  instrument_alias VARCHAR(100),
  card_last_four   VARCHAR(4),
  expiry_date      VARCHAR(10),
  is_default       TINYINT(1) DEFAULT 0,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_loc (location_id),
  INDEX idx_token (instrument_token)
);

-- ─── Update Subscriptions to include recurring tokens ────
ALTER TABLE location_subscriptions 
ADD COLUMN IF NOT EXISTS recurring_token VARCHAR(255) NULL AFTER gopayfast_token;
