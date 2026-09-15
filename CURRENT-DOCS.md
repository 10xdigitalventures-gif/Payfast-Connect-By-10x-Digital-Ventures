# 10x Gateway Connect — Current Architecture

## Architecture
One production domain serves three isolated GHL Marketplace apps: PayFast, Whop, and Swich. Each app has a dedicated OAuth callback, token/credential table, settings form, checkout, provider query, and callback/webhook namespace.

## Data stores
- `payfast_ghl_installations`: PayFast OAuth, merchant credentials, environment, provider keys.
- `whop_ghl_installations`: Whop OAuth, API/company/webhook credentials, conversion settings, provider keys.
- `swich_ghl_installations`: Swich OAuth, separate live/sandbox credentials and checkout URLs, provider keys.
- `payments`: shared transaction ledger; every standalone query filters by both `location_id` and `provider`.
- `payment_refunds`, `payment_instruments`, `ghl_provider_subscriptions`: provider-aware supporting ledgers.

## Request flow
1. The gateway-specific OAuth callback stores tokens only in that app's table.
2. The gateway-specific settings page saves only that provider's credentials.
3. Provider provisioning registers the gateway-specific checkout and query URLs.
4. Checkout creates a provider-tagged pending payment.
5. A verified callback/webhook atomically moves it to a terminal state.
6. The app sends the GHL server notification with that app's OAuth token and provider key.
7. The embedded checkout sends exactly one JSON-string terminal message.

## Deployment order
1. Deploy code.
2. Run the provider SQL migration.
3. Configure provider-specific `*_GHL_*` environment variables.
4. Configure exact Marketplace and gateway webhook URLs.
5. Test sandbox/test mode.
6. Run one limited live transaction.
7. Migrate locations gradually; retain rollback.

## Current limitations
- Legacy combined routes remain for migration compatibility.
- Swich endpoint/checksum/refund/subscription behavior requires confirmation from official merchant onboarding documents before production use.
- Production E2E tests require real provider credentials and cannot be completed by CI alone.
