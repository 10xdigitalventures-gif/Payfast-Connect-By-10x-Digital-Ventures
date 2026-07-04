# Deployment Guide

## Environment
Set these variables in Hostinger:
- `NEXT_PUBLIC_APP_URL`
- `SESSION_SECRET`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `GHL_CLIENT_ID`
- `GHL_CLIENT_SECRET`
- `NEXT_PUBLIC_ADMIN_PASSWORD`

## Database
Import `scripts/setup.sql` into MySQL.

## Run mode
- Use production start, not dev mode.
- Command: `npm run build` then `npm run start`

## CRM setup
1. Visit `/install`
2. Authorize CRM access
3. After redirect, save GoPayFast credentials in `/settings`
4. Verify dashboard shows the correct `location_id`

## Webhooks
Use these URLs in GoPayFast:
- Notification URL: `https://payfast.10xdigitalventures.com/api/payfast/itn`
- Return URL: `https://payfast.10xdigitalventures.com/pay/success`
- Cancel URL: `https://payfast.10xdigitalventures.com/pay/success`

## Test flow
1. Install the app
2. Confirm `/settings` shows login credentials
3. Save gateway fields
4. Confirm dashboard shows connected status

## Troubleshooting
- 502 errors usually mean the app is not running in production mode.
- If `location_id` is wrong, reinstall the app.
- If login creds are missing, check the `installation_credentials` table.
