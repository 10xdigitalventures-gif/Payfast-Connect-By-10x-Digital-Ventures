-- Standalone Whop columns. Compatible with MySQL 8.0; rerunnable without
-- unsupported ALTER TABLE ADD COLUMN IF NOT EXISTS syntax.
-- Prerequisite: scripts/whop-ghl-app.sql and scripts/setup.sql.
-- Run against the intended database; metadata checks use DATABASE().

-- Add whop_ghl_installations.whop_api_key only when missing; compatible with MySQL 8.0.
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whop_ghl_installations' AND COLUMN_NAME = 'whop_api_key'),
  'DO 0',
  'ALTER TABLE `whop_ghl_installations` ADD COLUMN `whop_api_key` TEXT NULL AFTER expires_at'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Add whop_ghl_installations.whop_company_id only when missing; compatible with MySQL 8.0.
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whop_ghl_installations' AND COLUMN_NAME = 'whop_company_id'),
  'DO 0',
  'ALTER TABLE `whop_ghl_installations` ADD COLUMN `whop_company_id` VARCHAR(255) NULL AFTER whop_api_key'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Add whop_ghl_installations.whop_webhook_secret only when missing; compatible with MySQL 8.0.
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whop_ghl_installations' AND COLUMN_NAME = 'whop_webhook_secret'),
  'DO 0',
  'ALTER TABLE `whop_ghl_installations` ADD COLUMN `whop_webhook_secret` VARCHAR(255) NULL AFTER whop_company_id'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Add whop_ghl_installations.whop_rate_mode only when missing; compatible with MySQL 8.0.
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whop_ghl_installations' AND COLUMN_NAME = 'whop_rate_mode'),
  'DO 0',
  'ALTER TABLE `whop_ghl_installations` ADD COLUMN `whop_rate_mode` ENUM(''fixed'',''live'') NOT NULL DEFAULT ''fixed'' AFTER whop_webhook_secret'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Add whop_ghl_installations.whop_exchange_rate only when missing; compatible with MySQL 8.0.
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whop_ghl_installations' AND COLUMN_NAME = 'whop_exchange_rate'),
  'DO 0',
  'ALTER TABLE `whop_ghl_installations` ADD COLUMN `whop_exchange_rate` DECIMAL(12,4) NOT NULL DEFAULT 280 AFTER whop_rate_mode'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Add whop_ghl_installations.whop_fee_percent only when missing; compatible with MySQL 8.0.
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whop_ghl_installations' AND COLUMN_NAME = 'whop_fee_percent'),
  'DO 0',
  'ALTER TABLE `whop_ghl_installations` ADD COLUMN `whop_fee_percent` DECIMAL(8,4) NOT NULL DEFAULT 10 AFTER whop_exchange_rate'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Add whop_ghl_installations.whop_currency only when missing; compatible with MySQL 8.0.
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whop_ghl_installations' AND COLUMN_NAME = 'whop_currency'),
  'DO 0',
  'ALTER TABLE `whop_ghl_installations` ADD COLUMN `whop_currency` ENUM(''PKR'',''USD'') NOT NULL DEFAULT ''PKR'' AFTER whop_fee_percent'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Add whop_ghl_installations.provider_api_key only when missing; compatible with MySQL 8.0.
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whop_ghl_installations' AND COLUMN_NAME = 'provider_api_key'),
  'DO 0',
  'ALTER TABLE `whop_ghl_installations` ADD COLUMN `provider_api_key` VARCHAR(255) NULL AFTER whop_currency'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Add whop_ghl_installations.provider_publishable_key only when missing; compatible with MySQL 8.0.
SET @migration_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whop_ghl_installations' AND COLUMN_NAME = 'provider_publishable_key'),
  'DO 0',
  'ALTER TABLE `whop_ghl_installations` ADD COLUMN `provider_publishable_key` VARCHAR(255) NULL AFTER provider_api_key'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Backfill nullable legacy credentials once; never overwrite existing
-- dedicated Whop values. Mode/rate/fee/currency are NOT NULL defaults, so
-- a rerun must not import legacy configuration over administrator settings.
UPDATE whop_ghl_installations w
JOIN installations i ON i.location_id=w.location_id
SET w.whop_api_key=COALESCE(w.whop_api_key,i.whop_api_key),
    w.whop_company_id=COALESCE(w.whop_company_id,i.whop_company_id),
    w.whop_webhook_secret=COALESCE(w.whop_webhook_secret,i.whop_webhook_secret)
WHERE i.whop_enabled=1
  AND (w.whop_api_key IS NULL OR w.whop_company_id IS NULL OR w.whop_webhook_secret IS NULL);
