# CRM Custom Payment Provider Setup Guide

## Final behavior
This app now acts as the CRM-side payment connector only. Local product, invoice, and payment-link pages were removed from the UI.

## Step 1 - CRM Marketplace settings
Fill these fields in your CRM app:

| Field | Value |
|---|---|
| Provider Name | GoPayFast by 10x Digital Ventures |
| Description | CRM-native GoPayFast payment connector |
| Logo URL | https://payfast.10xdigitalventures.com/logo.png |
| queryUrl | https://payfast.10xdigitalventures.com/api/provider/query |
| paymentsUrl | https://payfast.10xdigitalventures.com/checkout |
| Custom Page URL | https://payfast.10xdigitalventures.com/payfast-config |

## Step 2 - Required scopes
- payments.write
- payments.readonly
- contacts.write
- contacts.readonly
- opportunities.write
- locations.readonly

## Step 3 - Final flow
1. User installs the app from CRM Marketplace
2. OAuth saves location tokens and creates login credentials
3. User opens CRM payment settings and configures GoPayFast details
4. CRM loads the checkout iframe when a payment is created
5. PayFast ITN updates the payment state
6. CRM sees the payment as captured and continues its automation

## Step 4 - Test
1. Install on a test location
2. Verify `/settings` shows credentials
3. Save credentials
4. Test a payment from CRM
5. Confirm the location stays isolated by `location_id`

## Support
- Email: support@10xdigitalventures.com
- WhatsApp: +92 320 2900295
