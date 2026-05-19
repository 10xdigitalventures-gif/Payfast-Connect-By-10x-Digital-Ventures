ALTER TABLE installations
  ADD COLUMN merchant_name VARCHAR(200) NULL AFTER expires_at,
  ADD COLUMN store_id VARCHAR(100) NULL AFTER merchant_name;
