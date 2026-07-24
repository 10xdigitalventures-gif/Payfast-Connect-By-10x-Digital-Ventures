-- ═══════════════════════════════════════════════════════
-- Phase 4 — Suspension adapter schema
-- Run in phpMyAdmin AFTER agency-billing.sql + agency-whop-billing.sql
--
-- Adds grace-period tracking + a swappable-suspension audit log so the
-- GHL suspend/resume endpoint can change without touching business logic.
-- ═══════════════════════════════════════════════════════

-- 1. Add past_due state + grace window to subscriptions
ALTER TABLE location_subscriptions
  MODIFY status ENUM('trial','active','past_due','suspended','cancelled') DEFAULT 'trial';

ALTER TABLE location_subscriptions
  ADD COLUMN IF NOT EXISTS grace_until    DATETIME NULL AFTER cancel_at,
  ADD COLUMN IF NOT EXISTS last_payment_at DATETIME NULL AFTER grace_until;

-- 2. Audit trail for every suspend/resume/cancel attempt (all agencies)
CREATE TABLE IF NOT EXISTS suspension_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_id  VARCHAR(100) NOT NULL,
  company_id   VARCHAR(100) NULL,
  action       ENUM('suspend','resume','cancel') NOT NULL,
  strategy     VARCHAR(40)  NULL,
  reason       VARCHAR(255) NULL,
  ghl_status   VARCHAR(20)  NULL,   -- ok | failed | skipped
  ghl_response TEXT         NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_suspension_actions_location (location_id),
  INDEX idx_suspension_actions_action (action)
);
