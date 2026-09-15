# Standalone Swich GHL App Setup

Create a separate HighLevel Marketplace app named **10x Swich App**.

## URLs
- OAuth redirect: `https://payfast.10xdigitalventures.com/oauth/swich/callback`
- Settings: `https://payfast.10xdigitalventures.com/apps/swich/settings`
- Payment page: `https://payfast.10xdigitalventures.com/apps/swich/checkout`
- Query URL: `https://payfast.10xdigitalventures.com/api/apps/swich/query`
- Callback/webhook: `https://payfast.10xdigitalventures.com/api/apps/swich/callback`

## Database
Run `scripts/swich-standalone-app.sql`.

## Environment
Set `SWICH_GHL_CLIENT_ID`, `SWICH_GHL_CLIENT_SECRET`, `SWICH_GHL_SHARED_SECRET`, `SWICH_GHL_APP_TOKEN`, `SWICH_GHL_MARKETPLACE_APP_ID`, and `SWICH_GHL_PROVIDER_LOGO_URL`.

## Important onboarding gate
The checkout URL, field names, checksum source string, callback statuses, refund API, and recurring-payment support must be confirmed against the official merchant-specific Swich onboarding document before live use. The current implementation follows the existing repository contract and intentionally reports subscriptions/refunds as unsupported.

## Test order
1. Configure sandbox credentials and official sandbox checkout URL.
2. Verify checksum examples against Swich-provided fixtures.
3. Test success, decline, cancellation, timeout, amount mismatch, invalid checksum, and duplicate callback delivery.
4. Confirm the GHL receipt advances from the JSON-string success message.
5. Run one limited live transaction only after Swich approves the integration.
