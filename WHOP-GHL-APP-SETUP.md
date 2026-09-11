# 10x Whop App — GHL Marketplace Setup

Create a separate HighLevel Marketplace app named **10x Whop App**.

## URLs

- Redirect URL: `https://payfast.10xdigitalventures.com/oauth/whop/callback`
- GHL webhook URL: `https://payfast.10xdigitalventures.com/api/ghl/whop/webhooks`
- Whop payment webhook URL: `https://payfast.10xdigitalventures.com/api/whop/webhook`

The GHL webhook and Whop payment webhook are different endpoints and must not be interchanged.

## Database

Run:

```bash
mysql -u <user> -p <database> < scripts/whop-ghl-app.sql
```

This creates a separate token store so the 10x Whop App does not overwrite the existing PayFast app installation tokens.

## Environment variables

Configure the `WHOP_GHL_*` variables from `.env.example` in the production hosting environment. Never commit real credentials.

For `WHOP_GHL_WEBHOOK_PUBLIC_KEY`, use the webhook verification public key supplied for the GHL Marketplace app. If stored on one line, represent line breaks as `\\n`.

## Required GHL app scopes

Select the scopes required by the payment-provider flow, including OAuth installation, locations, contacts, orders/invoices, transactions, and custom payment providers. Keep the final scope list limited to features used by the app.

## Whop webhook

In the Whop dashboard, register `/api/whop/webhook` and subscribe at minimum to payment success/failure and any subscription or setup-intent events used by the app. Store the signing secret in `WHOP_WEBHOOK_SECRET` or the per-location settings supported by the application.
