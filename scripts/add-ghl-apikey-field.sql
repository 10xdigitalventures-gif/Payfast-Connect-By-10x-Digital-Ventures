-- Add fields to store per-location HighLevel keys used to authenticate queries
ALTER TABLE installations
  ADD COLUMN provider_api_key VARCHAR(255) NULL AFTER environment,
  ADD COLUMN provider_publishable_key VARCHAR(255) NULL AFTER provider_api_key;
