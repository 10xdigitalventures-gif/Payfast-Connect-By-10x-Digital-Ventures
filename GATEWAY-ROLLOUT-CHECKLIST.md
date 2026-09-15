# Standalone Gateway Rollout Checklist

## Before deployment
- Back up the production database.
- Confirm `SESSION_SECRET` is random and at least 32 characters.
- Run `npm run verify:rollout` with production environment variables loaded.
- Confirm the PayFast, Whop, and Swich Marketplace apps use different client IDs and secrets.

## Database migrations
1. `scripts/payfast-ghl-app.sql`
2. `scripts/whop-ghl-app.sql`
3. `scripts/whop-standalone-app.sql`
4. `scripts/whop-ghl-provider-compliance-migration.sql`
5. `scripts/swich-standalone-app.sql`

## Staged rollout
For each gateway, use one test location first. Verify OAuth install, credential save, sandbox/test initiation, signed callback, duplicate delivery, GHL receipt transition, uninstall isolation, and rollback before adding more locations.

## Provider gates
- PayFast: complete sandbox success, decline, cancel, duplicate ITN, and one limited live payment.
- Whop: complete payment, subscription, setup, refund, cancellation, duplicate webhook, and one limited live payment.
- Swich: obtain official merchant-specific API/checksum documentation before any live transaction.

## Authentication checks
- Anonymous requests to `/dashboard`, `/settings`, `/billing`, and `/agency` redirect to login.
- A subaccount session cannot open agency pages.
- Invalid/expired JWT cookies are rejected.
- Logout deletes `pf_session`.

## Rollback
Keep the legacy combined app registered during the staged migration. If a standalone provider fails, stop onboarding new locations, restore the previous deployment, and leave existing provider credentials untouched. Do not repoint a standalone Marketplace app to combined routes.
