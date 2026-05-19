# GoPayFast Connect

GoPayFast Connect is a CRM-first GoHighLevel payment connector. Every install is scoped by `location_id`, so each sub-account keeps its own settings, billing, and credentials isolated.

## Final surface
- `/dashboard`
- `/settings`
- `/billing`
- `/install`
- `/agency`
- `/apply`
- `/support`

## What it does
- CRM install and OAuth handling
- Per-location credential storage
- PayFast ITN and CRM sync
- Agency billing and SaaS controls
- Merchant onboarding and admin review

## Support
- Email: `support@10xdigitalventures.com`
- WhatsApp: `+92 320 2900295`

## Notes
- Local payment/catalog CRUD pages were removed from the final UI.
- Always filter location data by `location_id`.

## Tech
- Next.js App Router
- TypeScript
- MySQL (`mysql2`)
- JWT auth (`jose`)
- GoHighLevel OAuth + provider APIs

See `DEPLOY.md` for setup instructions.
