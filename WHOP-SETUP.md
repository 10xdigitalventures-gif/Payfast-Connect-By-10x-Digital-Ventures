# Whop Payments Setup

GoPayFast Connect now supports **Whop** as a second payment provider alongside GoPayFast. When both are enabled for a location, the checkout page shows a payment-method selector so the customer can choose GoPayFast (PKR cards/bank) or Whop (card, BNPL & crypto, charged in USD).

Whop is optional and per-location: leave it disabled and nothing changes for existing GoPayFast merchants.

## 1. Run the database migration

Apply the Whop columns to your existing database (safe to re-run; uses IF NOT EXISTS):

```bash
mysql -u <user> -p payfast_ghl < scripts/whop-module.sql
```

This adds Whop credential columns to installations and provider / whop_plan_id / whop_checkout_id / custom_str3 columns to payments.

## 2. Get your Whop credentials

From your Whop dashboard (https://whop.com):

1. Company ID - looks like biz_xxxxxxxx.
2. API Key - create one under Developer / API settings.
3. Webhook Secret - create a webhook (see step 4) and copy its signing secret (starts with whsec_).

## 3. Configure in Settings

Open Settings -> Whop in the app and fill in:

- Enable Whop - turns Whop on as a checkout option for this location.
- Whop API Key, Company ID, Webhook Secret - from step 2.
- Exchange rate mode - choose Fixed (always use the rate you set below) or Live (fetch the current PKR->USD rate automatically at checkout, using the rate below as a fallback if the live lookup fails).
- PKR -> USD rate - how many PKR equal 1 USD (default 280). The PKR order total is converted to USD before charging.
- Gateway fee (%) - optional surcharge added on top of the order total.

Save.

## 4. Add the webhook in Whop

Whop confirms payments through a signed webhook. In your Whop dashboard, add a webhook pointing to:

```
{NEXT_PUBLIC_APP_URL}/api/whop/webhook
```

The exact URL is also shown at the bottom of the Settings -> Whop tab. Subscribe to the payment.succeeded event and copy the generated signing secret back into the Webhook Secret field.

Without a valid secret, incoming webhooks are rejected (HTTP 401) for security.

## How it works

1. Customer picks Whop at checkout and presses Pay.
2. The app converts PKR -> USD (rate + optional fee), creates a Whop checkout configuration via the Whop API, and opens the hosted Whop checkout in a popup.
3. The checkout iframe polls /api/ghl/payment-status (provider-agnostic, keyed by an unguessable basket token).
4. When Whop sends a signed payment.succeeded webhook, the payment row is marked complete, and the CRM is synced (contact upsert, tags, opportunity stage, workflow trigger) exactly like the GoPayFast flow.
5. The checkout page detects the complete status and reports success back to HighLevel.

## Notes

- Whop charges in USD. Keep the exchange rate reasonably current to avoid over/undercharging.
- Refunds and disputes are managed inside the Whop dashboard.
- GoPayFast remains the default; if only GoPayFast is enabled the checkout is unchanged.
