# 10x Whop App — GHL Marketplace Setup

Create a separate HighLevel Marketplace app named **10x Whop App**.

## URLs

- Redirect URL: `https://payfast.10xdigitalventures.com/oauth/whop/callback`
- Settings URL: `https://payfast.10xdigitalventures.com/apps/whop/settings`
- Payment URL: `https://payfast.10xdigitalventures.com/apps/whop/checkout`
- Provider query URL: `https://payfast.10xdigitalventures.com/api/apps/whop/query`
- GHL app webhook URL: `https://payfast.10xdigitalventures.com/api/ghl/whop/webhooks`
- Whop payment webhook URL: `https://payfast.10xdigitalventures.com/api/apps/whop/webhook`

The GHL app webhook and Whop payment webhook are different endpoints.

## Database

Run `scripts/whop-ghl-app.sql`, `scripts/whop-standalone-app.sql`, and `scripts/whop-ghl-provider-compliance-migration.sql` in that order.

## Environment variables

Configure the `WHOP_GHL_*` variables from `.env.example`. Never reuse PayFast or Swich credentials.

## Required verification

Test one-time success/failure, subscription renewal/cancellation, card setup, partial/full refund, duplicate webhook delivery, GHL receipt transition, and a limited live payment before broad rollout.


## Dedicated Whop Checkout (security branch)
- Configure custom settings page URL as `https://payfast.10xdigitalventures.com/apps/whop/settings?locationId={{location.id}}`.
- Store **Whop Marketplace app** `WHOP_GHL_SHARED_SECRET` (Advanced Settings → Auth → Shared Secret), `SESSION_SECRET` (32+ characters), and exact `NEXT_PUBLIC_APP_URL`. Do not reuse PayFast or SWICH secrets.
- The settings page uses GHL `REQUEST_USER_DATA_RESPONSE` encrypted context; backend decrypts and checks admin role, location, company and Whop OAuth installation, then returns a provider/location-bound bearer for settings GET/POST.
- Dedicated `/apps/whop/checkout` no longer uses the shared PayFast/Whop routing component. It supports GHL `payment_initiate_props` and `setup_initiate_props`, Whop-hosted checkout and setup, recurring plan initiation, 2-second payment-status polling, and verified-webhook-only terminal success. It never marks a payment successful on browser redirect alone.
- Payment initiation requires the Whop provider `publishableKey` from GHL; it binds location to Whop installation and performs a server-side `GET /payments/orders/{orderId}` using **GHL API v3**, matching location ID, amount, currency and contact if available. **An orderId is mandatory; GHL channels without an order ID fail closed until an independently verified alternative is implemented.**
- Status polling goes to `/api/apps/whop/status`; requires Whop provider, location, basket ID, and an additional 128-bit random status token.
- Standalone OAuth and custom-provider API calls use `Version: v3`. Whop's **own API** remains `api.whop.com/api/v1` per Whop checkout implementation; GHL v3 and Whop API v1 are different systems.
- **Not yet production-approved:** GHL order retrieval response across channels; subscription lifecycle, actual Whop webhooks, card-on-file setup, partial refunds, currency/fee rules, iframe response encoding, CI, and sandbox/live payments require verification.
