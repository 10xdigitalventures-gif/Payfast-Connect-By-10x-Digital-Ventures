# 10x Gateway Connect

A multi-app GoHighLevel payment connector served from one domain. PayFast, Whop, and Swich are separate Marketplace apps with independent OAuth credentials, gateway settings, checkout routes, provider keys, webhooks/callbacks, and deployment migrations.

## Standalone apps
| App | Settings | Checkout | Provider query | Callback/webhook |
| --- | --- | --- | --- | --- |
| PayFast | `/apps/payfast/settings` | `/apps/payfast/checkout` | `/api/apps/payfast/query` | `/api/apps/payfast/itn` |
| Whop | `/apps/whop/settings` | `/apps/whop/checkout` | `/api/apps/whop/query` | `/api/apps/whop/webhook` |
| Swich | `/apps/swich/settings` | `/apps/swich/checkout` | `/api/apps/swich/query` | `/api/apps/swich/callback` |

The legacy combined routes remain temporarily for migration compatibility. New Marketplace apps must use the standalone URLs.

## Provider support
- **PayFast:** one-time payments and repository-supported recurring flows; live/sandbox credentials are selected in its own app.
- **Whop:** one-time payments, subscriptions, card setup, refunds, and membership cancellation with signed webhooks.
- **Swich:** one-time payment foundation. Live use is blocked on confirmation of merchant-specific official API/checksum documentation; subscriptions and refunds are not advertised.

## Setup guides
- `PAYFAST-GHL-APP-SETUP.md`
- `WHOP-GHL-APP-SETUP.md`
- `SWICH-GHL-APP-SETUP.md`
- `DEPLOY.md`

## Security and reliability
- Scope all data by `location_id` and provider.
- Never share OAuth or gateway credentials between apps.
- Verify provider signatures/checksums before state changes.
- Process terminal callbacks idempotently.
- Send HighLevel terminal browser messages as JSON strings.

## Tech
Next.js App Router, TypeScript, MySQL, GoHighLevel OAuth/custom-provider APIs.
