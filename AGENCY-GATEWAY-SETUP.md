# Agency gateway setup

## Audit result

The agency dashboard, plans, subscriptions, invoices, wallet, suspension and rebilling modules exist. The audit found and corrected these gateway blockers:

- the environment field existed but PayFast always called the live Pakistan host;
- the token request used a query-string GET instead of the documented backend form POST;
- the agency callback always verified with live credentials;
- the settings API returned payment secrets to the browser and blank saves could overwrite existing secrets;
- the old “Connect PayFast” route targeted South Africa's unrelated PayFast OAuth service and contained a malformed URL;
- the agency README described proxy routes that are not present;
- invoices did not record which gateway processed them.

## Database migration

Run `scripts/agency-gateway-environments.sql` against the production database after the existing agency/Whop migrations.

## PayFast Pakistan

1. Enter separate Live and Sandbox/UAT merchant credentials in `/agency/settings`.
2. Select `PayFast Pakistan` as the gateway.
3. Select `Sandbox / UAT` while testing. This uses `ipguat.apps.net.pk`.
4. Complete a successful and failed test payment and verify the invoice state.
5. Switch to `Live` only after production credentials, callback allowlisting and merchant approval are complete.

## Swich Pakistan

1. Register with Swich and obtain sandbox credentials.
2. Ask Swich onboarding for the hosted Landing Page checkout URL for sandbox and live.
3. Enter the Client ID, Secret Key and checkout URL in `/agency/settings`.
4. Configure the callback URL as `https://payfast.10xdigitalventures.com/api/swich/callback`.
5. Select `Swich Pakistan` and `Sandbox / UAT`, then test success, failure and tampered callback cases.
6. Swich callbacks are verified with the documented HMAC-SHA256 string `SWCallback:CustomerTransactionId:OrderId:Amount:Status` and the invoice amount is checked before activation.

> Swich onboarding documents can vary by merchant/product. Confirm the hosted checkout request checksum prefix and exact field casing with the credentials pack before production activation.

## Security

Secrets are write-only in the browser: saved secrets are represented by flags and are preserved when an empty secret field is submitted. Never put production credentials in Git or chat.
