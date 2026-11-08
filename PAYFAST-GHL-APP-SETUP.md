# Standalone PayFast GHL App Setup

Create a separate HighLevel Marketplace app for **PayFast Connect by 10x Digital Ventures**.

## URLs

- OAuth redirect: `https://payfast.10xdigitalventures.com/oauth/payfast/callback`
- Custom settings page: `https://payfast.10xdigitalventures.com/apps/payfast/settings`
- Payment page: `https://payfast.10xdigitalventures.com/apps/payfast/checkout`
- Provider query URL: `https://payfast.10xdigitalventures.com/api/apps/payfast/query`
- PayFast ITN/return endpoint: `https://payfast.10xdigitalventures.com/api/apps/payfast/itn`

The same domain is used, but the PayFast app has its own OAuth identity, token/credential table, payment initiation, callback processing, query verification, and CRM notification token.

## Database migration

Run:

```bash
mysql -u <user> -p <database> < scripts/payfast-ghl-app.sql
```

The migration creates `payfast_ghl_installations` and copies existing PayFast installations once without overwriting standalone rows.

## Environment

Set `PAYFAST_GHL_CLIENT_ID`, `PAYFAST_GHL_CLIENT_SECRET`, `PAYFAST_GHL_SHARED_SECRET`, `PAYFAST_GHL_APP_TOKEN`, `PAYFAST_GHL_MARKETPLACE_APP_ID`, and `PAYFAST_GHL_PROVIDER_LOGO_URL`. Do not reuse Whop or Swich Marketplace credentials.

## Rollout

1. Run the database migration.
2. Add production environment variables.
3. Configure the exact OAuth redirect URL in HighLevel.
4. Install the PayFast app in one test location.
5. Save sandbox credentials in the PayFast-only settings page.
6. Complete sandbox success, decline, cancellation, duplicate callback, and GHL receipt tests.
7. Repeat with a limited live payment before migrating all locations.


## Marketplace custom page authentication (security branch)
- Configure custom page URL as `https://payfast.10xdigitalventures.com/apps/payfast/settings?locationId={{location.id}}`.
- Configure `PAYFAST_GHL_SHARED_SECRET` with the **PayFast app's own** HighLevel Advanced Settings → Auth → Shared Secret. Do not reuse other apps' secrets.
- Configure `SESSION_SECRET` (32+ random characters) and `NEXT_PUBLIC_APP_URL=https://payfast.10xdigitalventures.com`.
- In HighLevel's iframe, the page requests `REQUEST_USER_DATA`, forwards encrypted `REQUEST_USER_DATA_RESPONSE.payload` to `/api/marketplace/session`; the backend decrypts it, requires HighLevel admin role, checks installed app/location, and issues a 15-minute PayFast/location-scoped bearer token. This avoids third-party session cookies.
- API v3: standalone OAuth and custom-provider API calls now use `Version: v3`.
- **Not yet production-approved:** GHL iframe SSO, browser origin handling, sandbox installation, legacy compatibility, amount checks and CI must pass.
