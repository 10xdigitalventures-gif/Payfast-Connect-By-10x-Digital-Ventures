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
