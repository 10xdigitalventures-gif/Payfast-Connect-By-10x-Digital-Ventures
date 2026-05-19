# API Reference

Final internal API surface for the CRM-first build.

## Base
- Base URL: `https://your-domain.com/api`
- Private endpoints usually require the `pf_session` cookie.

## Auth and setup
- `GET /api/auth/login` - login status/debug info
- `POST /api/auth/login` - user login
- `POST /api/auth/logout` - clear session
- `POST /api/auth/agency-login` - agency login
- `POST /api/apply` - merchant application submit
- `GET /api/settings` - fetch per-location settings and saved login credentials
- `POST /api/settings` - save per-location settings

## GHL / CRM integration
- `POST /api/provider/query` - CRM provider query endpoint
- `POST /api/ghl/query` - CRM webhook receiver
- `POST /api/provider/provider/provision` - provision provider mapping
- `GET|POST /api/provider/config` - provider config iframe
- `POST /api/provider/notify` - internal CRM sync event
- `POST /api/provider/pay` - checkout helper for CRM flows
- `GET|POST /api/payfast/itn` - PayFast ITN processing
- `POST /api/payfast/create` - PayFast payment session creation
- `POST /api/pay/create` - public payment flow handler
- `GET /api/payments/custom-provider/connect` - connect provider to a location
- `POST /api/payments/custom-provider/disconnect` - disconnect provider from a location

## Agency and billing
- `GET /api/agency/locations`
- `GET|POST /api/agency/settings`
- `GET|POST /api/agency/saas/*`
- `GET /api/billing/status`
- `GET /api/billing/plans`
- `GET /api/billing/invoices`
- `POST /api/billing/subscribe`
- `POST /api/billing/cancel`
- `GET|POST /api/billing/wallet`
- `GET|POST /api/billing/payment-methods`

## Admin
- `GET /api/admin/applications`
- `POST /api/admin/applications/[id]`
- `GET /api/admin/billing`
- `GET|POST /api/admin/billing/settings`
- `POST /api/admin/billing/[id]/activate`
- `POST /api/admin/billing/[id]/suspend`
- `POST /api/admin/login`
- `POST /api/admin/logout`

## Notes
- Deleted local product/invoice/payment-link CRUD endpoints are not part of the final UI.
- All location-scoped records must filter by `location_id`.
