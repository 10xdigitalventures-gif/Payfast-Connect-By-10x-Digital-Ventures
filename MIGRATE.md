DB migration & integration checklist

1) Database migration

 - Run the SQL in scripts/add-ghl-apikey-field.sql to add provider_api_key and provider_publishable_key to the installations table.

   mysql -u user -p your_db < scripts/add-ghl-apikey-field.sql

2) Environment variables

 - Set the following env vars in your runtime (staging/prod):
   - GHL_APP_TOKEN (marketplace token)
   - AGENCY_GHL_APP_TOKEN (if using agency app)
   - NEXT_PUBLIC_APP_URL
   - PAYFAST_CLIENT_ID / PAYFAST_CLIENT_SECRET
   - DB_HOST/DB_USER/DB_PASSWORD/DB_NAME
   - ALERT_WEBHOOK (optional)

3) Integration test sequence

 - Install marketplace app for a test location in HighLevel.
 - Confirm INSTALL webhook creates an installations row (app/api/provider/query -> INSTALL).
 - Open Manage Integration in HighLevel — the config iframe loads app/payfast-config.
 - Save merchant config (merchant_id/merchant_key) via the iframe (POST /api/provider/config).
 - ensureCustomProviderProvisioned should call GHL connect; if GHL returns provider keys, they will be saved to installations.provider_api_key.
 - Use the saved provider_api_key for subsequent queryUrl calls, sent as X-API-KEY or Authorization: ApiKey <key>.
 - Verify payment flow by creating a payment in the iframe (app/checkout) and making /api/provider/query verify requests.

4) Alerts

 - Configure ALERT_WEBHOOK to a Slack/Teams/HTTP collector to receive alerts about provisioning errors and unauthorized requests.
