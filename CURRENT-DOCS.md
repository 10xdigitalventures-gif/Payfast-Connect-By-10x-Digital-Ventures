# GoPayFast Connect - Technical Docs

This is the final CRM-first reference for the codebase.

## Architecture
- Each install is scoped by `location_id`.
- OAuth callback stores installation tokens and creates login credentials.
- Dashboard and settings are per-location.
- Payments are handled through CRM integration and ITN/webhook processing.
- Agency billing remains separate from sub-account CRM installs.

## Core flow
1. User installs the app from CRM.
2. OAuth callback stores installation tokens and creates login credentials.
3. `/settings` reads saved credentials for that `location_id`.
4. CRM payment activity is handled via PayFast ITN and CRM sync routes.

## Important tables
- `installations`
- `installation_credentials`
- `users`
- `billing_invoices`
- `merchant_applications`
- `payments`
- `processed_webhooks`

## Key env vars
- `GHL_CLIENT_ID`
- `GHL_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `SESSION_SECRET`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `NEXT_PUBLIC_ADMIN_PASSWORD`

## Notes
- Local payment/catalog CRUD pages were removed from the final UI.
- Always query by `location_id` for sub-account data.
