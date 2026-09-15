# Deployment Guide

## Shared environment
Set `NEXT_PUBLIC_APP_URL`, `SESSION_SECRET`, and the MySQL variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## Provider app environment
- PayFast: `PAYFAST_GHL_CLIENT_ID`, `PAYFAST_GHL_CLIENT_SECRET`, `PAYFAST_GHL_SHARED_SECRET`, `PAYFAST_GHL_APP_TOKEN`, `PAYFAST_GHL_MARKETPLACE_APP_ID`, `PAYFAST_GHL_PROVIDER_LOGO_URL`.
- Whop: `WHOP_GHL_CLIENT_ID`, `WHOP_GHL_CLIENT_SECRET`, `WHOP_GHL_SHARED_SECRET`, `WHOP_GHL_APP_TOKEN`, `WHOP_GHL_MARKETPLACE_APP_ID`, `WHOP_GHL_PROVIDER_LOGO_URL`, `WHOP_GHL_WEBHOOK_PUBLIC_KEY`.
- Swich: `SWICH_GHL_CLIENT_ID`, `SWICH_GHL_CLIENT_SECRET`, `SWICH_GHL_SHARED_SECRET`, `SWICH_GHL_APP_TOKEN`, `SWICH_GHL_MARKETPLACE_APP_ID`, `SWICH_GHL_PROVIDER_LOGO_URL`.

Never reuse credentials between gateway apps.

## Database migrations
1. Base/production schema migrations already used by the deployment.
2. `scripts/payfast-ghl-app.sql`
3. `scripts/whop-ghl-app.sql`
4. `scripts/whop-standalone-app.sql`
5. `scripts/whop-ghl-provider-compliance-migration.sql`
6. `scripts/swich-standalone-app.sql`

Back up the production database first and apply migrations once.

## Marketplace URLs
Use the exact provider-specific URLs in `SITEMAP.md`. Do not point a standalone app to legacy combined routes.

## Verification
For each provider: install into one test location, save sandbox/test credentials, verify initiation and signed callback, test duplicate delivery, confirm the GHL receipt advances, and then run one limited live payment.

## Swich gate
Do not enable Swich live mode until official onboarding documentation confirms endpoint URLs, request field names, checksum construction, callback statuses, refunds, and recurring support.

## Runtime
Use `npm run build` followed by `npm run start`. Never use development mode in production.
