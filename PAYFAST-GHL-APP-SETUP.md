# Standalone PayFast GHL App Setup

Create a separate HighLevel Marketplace app for **PayFast Connect by 10x Digital Ventures**.

## URLs

- OAuth redirect: `https://payfast.10xdigitalventures.com/oauth/payfast/callback`
- Custom settings page: `https://payfast.10xdigitalventures.com/apps/payfast/settings`
- Payment page: `https://payfast.10xdigitalventures.com/apps/payfast/checkout`
- PayFast ITN/return endpoint: `https://payfast.10xdigitalventures.com/api/payfast/itn`

The same domain is used, but the PayFast app has its own OAuth identity, token table, settings surface, and provider registration.

## Database migration

Run:

```bash
mysql -u <user> -p <database> < scripts/payfast-ghl-app.sql
```

The migration creates `payfast_ghl_installations` and copies existing PayFast installations once without overwriting standalone rows.

## Environment

Set `PAYFAST_GHL_CLIENT_ID`, `PAYFAST_GHL_CLIENT_SECRET`, `PAYFAST_GHL_SHARED_SECRET`, `PAYFAST_GHL_APP_TOKEN`, and `PAYFAST_GHL_PROVIDER_LOGO_URL`. Do not reuse the Whop or Swich Marketplace credentials.

## Rollout

1. Run the database migration.
2. Add production environment variables.
3. Configure the exact OAuth redirect URL in HighLevel.
4. Install the PayFast app in one test location.
5. Save sandbox credentials in the PayFast-only settings page.
6. Complete sandbox success, decline, cancellation, duplicate callback, and GHL receipt tests.
7. Repeat with a limited live payment before migrating all locations.
