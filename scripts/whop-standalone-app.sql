-- Extend the separate Whop GHL installation store with Whop-only settings.
ALTER TABLE whop_ghl_installations
  ADD COLUMN IF NOT EXISTS whop_api_key TEXT NULL AFTER expires_at,
  ADD COLUMN IF NOT EXISTS whop_company_id VARCHAR(255) NULL AFTER whop_api_key,
  ADD COLUMN IF NOT EXISTS whop_webhook_secret VARCHAR(255) NULL AFTER whop_company_id,
  ADD COLUMN IF NOT EXISTS whop_rate_mode ENUM('fixed','live') NOT NULL DEFAULT 'fixed' AFTER whop_webhook_secret,
  ADD COLUMN IF NOT EXISTS whop_exchange_rate DECIMAL(12,4) NOT NULL DEFAULT 280 AFTER whop_rate_mode,
  ADD COLUMN IF NOT EXISTS whop_fee_percent DECIMAL(8,4) NOT NULL DEFAULT 10 AFTER whop_exchange_rate,
  ADD COLUMN IF NOT EXISTS whop_currency ENUM('PKR','USD') NOT NULL DEFAULT 'PKR' AFTER whop_fee_percent,
  ADD COLUMN IF NOT EXISTS provider_api_key VARCHAR(255) NULL AFTER whop_currency,
  ADD COLUMN IF NOT EXISTS provider_publishable_key VARCHAR(255) NULL AFTER provider_api_key;

-- Copy existing Whop gateway settings once without replacing standalone values.
UPDATE whop_ghl_installations w
JOIN installations i ON i.location_id=w.location_id
SET w.whop_api_key=COALESCE(w.whop_api_key,i.whop_api_key),
    w.whop_company_id=COALESCE(w.whop_company_id,i.whop_company_id),
    w.whop_webhook_secret=COALESCE(w.whop_webhook_secret,i.whop_webhook_secret),
    w.whop_rate_mode=COALESCE(i.whop_rate_mode,w.whop_rate_mode),
    w.whop_exchange_rate=COALESCE(i.whop_exchange_rate,w.whop_exchange_rate),
    w.whop_fee_percent=COALESCE(i.whop_fee_percent,w.whop_fee_percent),
    w.whop_currency=COALESCE(i.whop_currency,w.whop_currency)
WHERE i.whop_enabled=1;
