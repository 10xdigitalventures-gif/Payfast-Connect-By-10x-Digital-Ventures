# SaaS Mode — Agency Billing Flow

Yeh alag flow hai jismein ek **separate GHL marketplace app** agency ke
**agency-level (company) account** par install hota hai, SaaS plans manage karta
hai, aur clients (sub-accounts) ko recurring charge karta hai. Yeh customer-facing
invoice/funnel checkout se alag hai.

## 1. Do alag apps / do routes

| | Client app (existing) | Agency SaaS app (yeh flow) |
|---|---|---|
| Install kahan | Sub-account | Agency (company) account |
| OAuth redirect | `/oauth/callback` | `/agency/oauth/callback` |
| Client ID/Secret | `GHL_CLIENT_ID/SECRET` | `AGENCY_GHL_CLIENT_ID/SECRET` |
| Provider register | `appType: 'sub-account'` | `appType: 'agency'` |
| Dashboard | `/` | `/agency` |

Dono apps ka code ek hi Next.js deployment se serve hota hai; sirf route +
credentials + install-mode alag hain. Session cookie mein `installMode: 'agency'`
store hota hai.

## 2. Charging model — GHL primary + apna cron backup

**(A) Primary — GHL SaaS Configurator drives it:**
GHL SaaS mode har due sub-account ke liye humare custom provider ke queryUrl par
`charge_payment` (off-session) call karta hai. Yeh already implemented hai
(`app/api/ghl/query/route.ts`).

**(B) Backup — apna cron (`/api/rebilling/run` -> `lib/rebilling.ts`):**
Agar GHL koi due subscription miss kare to humara cron `location_subscriptions`
mein due rows dhoond kar khud recurring token se charge karta hai. Isko external
scheduler (Hostinger cron / GitHub Action) se rozana hit karain.

## 3. Processor routing toggle (PayFast + Whop)

`installations.route_subscription` = `'payfast'` ya `'whop'` decide karta hai ke
agency SaaS billing kis processor se ho. `installations.route_oneoff` one-off ke
liye. `payments.provider` har transaction par record hota hai.

## 4. GHL SaaS Configurator public API (humara bridge)

`lib/ghl-saas.ts` — ab **fixed**: har call par `Authorization: Bearer <agency
token>` + `Version: 2021-04-15` bhejta hai, token auto-refresh karta hai
(`getAgencyContext`), aur official paths use karta hai:

| Function | Method | Path |
|---|---|---|
| getAgencyPlans | GET | /saas-api/public-api/agency-plans/:companyId |
| getLocationSubscriptionDetails | GET | /saas-api/public-api/location-subscription/:locationId |
| enableSaasLocation | POST | /saas/enable-saas/:locationId |
| bulkEnableSaas | POST | /saas-api/public-api/bulk-enable-saas/:companyId |
| bulkDisableSaas | POST | /saas-api/public-api/bulk-disable-saas/:companyId |
| pauseSaasLocation | POST | /saas/pause-saas/:locationId |
| updateRebilling | POST | /saas-api/public-api/update-rebilling/:companyId |
| updateSaasSubscription | PUT | /saas-api/public-api/update-saas-subscription/:locationId |

> Note: SaaS Configurator public API sirf **Agency Pro / SaaS Pro ($497)** plan
> par available hai.

Routes: `app/api/agency/saas/{agency-plans, enable-location,
location-subscription, pause-location, rebilling, update-subscription}`.
Sab `getSession()` + `installMode === 'agency'` require karte hain.

## 5. Env vars (agency app)

```
AGENCY_GHL_CLIENT_ID=...
AGENCY_GHL_CLIENT_SECRET=...
AGENCY_OAUTH_REDIRECT_URI=https://payfast.10xdigitalventures.com/agency/oauth/callback
```

## 6. GHL-side setup checklist

1. Marketplace mein alag app banao, Distribution = **Agency**.
2. Redirect URL: `/agency/oauth/callback`. Scopes: SaaS + payments + locations.
3. Agency account par install karo -> `/agency/oauth/callback` token save karega
   aur provider ko `appType: 'agency'` se register karega.
4. SaaS Configurator mein plans banao; custom provider ko default set karo.
5. Cron backup ke liye rozana `/api/rebilling/run` hit karwao.

## 7. Whop for agency SaaS billing (DB + settings + cron)

**Migration:** phpMyAdmin mein `scripts/agency-whop-billing.sql` chalao. Yeh add karta hai:
- `agency_settings`: `whop_api_key`, `whop_company_id`, `whop_webhook_secret`,
  `whop_exchange_rate`, `whop_fee_percent`, `whop_rate_mode`, `whop_currency`,
  `route_subscription` (default `payfast`).
- `location_subscriptions`: `provider` (default `payfast`), `recurring_token`,
  `whop_member_id`, `whop_payment_method_id`, `whop_membership_id`, `payer_email`.

**Settings save:** `POST /api/agency/settings` ab yeh Whop fields bhi save karta hai
(agency dashboard settings se).

**Cron routing:** `lib/rebilling.ts` har due subscription ko uske `provider` ke
hisaab se charge karta hai:
- `payfast` -> agency merchant token se `performTokenizedTransaction` (RECURRING).
- `whop` -> agency Whop creds + PKR->USD convert + `chargeWhopPaymentMethod`
  (`plan_type: renewal`).

**Konsa processor:** `agency_settings.route_subscription` set karta hai naye SaaS
subscriptions ka default provider; har row ka apna `location_subscriptions.provider`
rebilling ke waqt use hota hai.

> Whop se charge tab hi hoga jab us subscription par `whop_member_id` +
> `whop_payment_method_id` mojood hon (yeh Whop subscription bante waqt save hote
> hain). Warna cron us row ko fail/skip kar deta hai.

## 8. Whop SaaS subscription create flow (member/payment capture)

**Naya route:** `POST /api/agency/saas/subscribe` (agency session required).
Input: `{ locationId, planId, email, frequency, provider? }`.
- provider = body.provider || agency_settings.route_subscription || 'payfast'.
- **Whop:** agency Whop creds se renewal-plan checkout banata hai
  (`createWhopCheckout`, planType=renewal, billing_period plan frequency se),
  metadata mein `kind: 'agency_saas'`, `location_id`, `plan_id`, `frequency`.
  Ek pending `location_subscriptions` row (status trial) bhi banata hai.
  Response mein `redirectUrl` (Whop checkout) client ko bhejo.
- **PayFast:** intent record hota hai; GHL SaaS Configurator + cron charge karte hain.

**Capture (webhook):** `/api/whop/webhook` mein ab `kind === 'agency_saas'` branch
hai jo **agency_settings.whop_webhook_secret** se verify karta hai aur in events par
`location_subscriptions` upsert karta hai:
- `payment.succeeded` / `membership.went_valid` / `setup_intent.succeeded` -> status
  active + period aage + `whop_member_id`, `whop_payment_method_id`,
  `whop_membership_id` save (jo payload mein mojood hon).
- `payment.failed` / `membership.went_invalid` -> status suspended.

> Whop renewal plan khud har cycle auto-bill karta hai (primary). Humara cron
> sirf backup hai aur tab charge karta hai jab `whop_payment_method_id` mojood ho.

**Whop dashboard webhook events (enable karo):** payment.succeeded,
payment.failed, membership.went_valid, membership.went_invalid,
setup_intent.succeeded. Webhook URL: `{APP_URL}/api/whop/webhook`.
