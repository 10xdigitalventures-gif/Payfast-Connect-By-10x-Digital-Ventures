USE payfast_ghl;

ALTER TABLE merchant_applications
ADD COLUMN IF NOT EXISTS username VARCHAR(100) NULL AFTER full_name,
ADD COLUMN IF NOT EXISTS integration_platform VARCHAR(100) NULL AFTER ghl_location_id;
