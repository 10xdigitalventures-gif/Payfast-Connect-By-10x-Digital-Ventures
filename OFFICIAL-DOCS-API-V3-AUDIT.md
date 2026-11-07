# Official documentation compatibility audit — 2026-11-07

Status: **PARTIAL; no production approval.** Scope: standalone PayFast, Whop, SWICH and HighLevel Marketplace payment-provider integration.

## HighLevel v3 — verified

- Version header `Version: v3` is supported on custom provider create, connect and capabilities endpoints. These routes remain `/payments/custom-provider/provider`, `/payments/custom-provider/connect`, `/payments/custom-provider/capabilities`; **do not prepend `/v3` to these paths** without endpoint-specific evidence.
- Provider creation: POST, `locationId` query, body `name,description,paymentsUrl,queryUrl,imageUrl,supportsSubscriptionSchedule`. Removed redundant `locationId` from creation bodies.
- Connection: POST, `locationId` query, body `live` and `test` key objects. Removed undocumented `liveMode` body property in PayFast provisioner.
- Capabilities: PUT, body `supportsSubscriptionSchedules` and `locationId` or `companyId`.
- Migrated three standalone provisioning clients from `Version: 2021-07-28` to `Version: v3`. OAuth/token flows, notifications, other GHL calls and legacy combined app **not yet migrated or certified**.
- Official HighLevel payment integration guide: Marketplace OAuth; custom settings iframe; checkout iframe events; server-side query operations `verify`, `refund`, `list_payment_methods`, `charge_payment`, `create_subscription`, `cancel_subscription`; signed notification, sandbox tests. Compare each implemented handler before enabling capabilities.

References:
- https://marketplace.gohighlevel.com/docs/2023-02-21/Versioning/index.html
- https://marketplace.gohighlevel.com/docs/ghl/payments/create-integration/index.html
- https://marketplace.gohighlevel.com/docs/ghl/payments/create-config/
- https://marketplace.gohighlevel.com/docs/ghl/payments/custom-provider-marketplace-app-update-capabilities/index.html
- https://help.gohighlevel.com/support/solutions/articles/155000002620-how-to-build-a-custom-payments-integration-on-the-platform

## Gateway API versions and documentation gaps

### Whop
- Current `lib/whop.ts` calls `https://api.whop.com/api/v1/checkout_configurations`; Whop's current published checkout walkthrough also uses `/api/v1` and v1 webhook API. **Do not rewrite Whop endpoints to v3.**
- Audit: checkout configuration payload shape; hosted checkout URL; USD/PKR conversion; payment and subscription event types; raw-body webhook signature; replay/idempotency; refund and recurring lifecycle; sandbox separation.
- https://whop.com/blog/integrate-checkout-api/

### PayFast Pakistan
- Current integration uses `ipg1.apps.net.pk` and `ipguat.apps.net.pk`, `GetAccessToken` / `PostTransaction`, `validation_hash`, merchant/store IDs. **These are not the same documented service as `docs.payfast.solutions`**, whose API uses `api.payfast.solutions/v1` with API-key/HMAC-SHA256. Do not migrate between them without confirming merchant provider identity and official Pakistan contract.
- Obtain official PayFast Pakistan merchant-specific IPG/ITN documentation and fixtures; verify token, signature, amount, currency, status, browser return vs server notification, refund and recurring endpoints.
- Existing code does not compare signed PayFast ITN amount against stored amount before finalizing. Treat as HIGH until resolved.
- https://docs.payfast.solutions/api (different PayFast-branded API; **not** a source of truth for apps.net.pk integration)

### SWICH
- Public SWICH developer landing page exists, but the merchant-specific hosted checkout field names, checksum string and callback verification were not confirmed from the accessible public page.
- Current `lib/swich.ts` uses `SWRequest:` and `SWCallback:` HMAC source strings; treat these as unverified until matched to official SWICH merchant fixtures.
- Block live rollout; request merchant documentation and test credentials.
- https://swichnow.io/developers/api-documentation

## Code-level risks discovered during this pass

1. **HIGH:** GHL v3 migration is limited to three provisioning clients; repository-wide GHL API call inventory, OAuth v3 and webhook compatibility remain open.
2. **HIGH:** PayFast ITN signature check currently does not verify stored amount/currency; add canonical merchant amount verification and negative tests.
3. **HIGH:** Existing PayFast and SWICH popup handlers still use `window.opener.postMessage(...,'*')`; restrict target origin with an authenticated flow-specific origin.
4. **HIGH:** Current standalone settings require a legacy `pf_session`, but Marketplace custom pages are embedded public iframe URLs. Verified SSO/session bootstrap is required to prevent legitimate installations failing.
5. **HIGH:** OAuth state utility exists but nonce issuance/consumption and all callback enforcement remain incomplete.
6. **HIGH:** Subscription schedule capability must reflect implemented operations, not just provider intent; PayFast/Whop capability declarations require endpoint-by-endpoint verification.
7. **HIGH:** API v3 response schema and failure/retry handling require contract tests and sandbox runs; code commits are **not** proof of successful migration.

## Acceptance gates

- Capture full outbound GHL API inventory and classify by documented v3 support.
- Compare all gateway requests/webhook fixtures with *the correct merchant's* official documentation.
- Execute Jest + Next.js build + GHL sandbox install/provision/connect/checkout/verify/refund tests for each supported capability.
- Re-audit security, payment state transitions, cross-tenant isolation, token refresh and database migrations.
- Keep main and production unchanged until tests and approval.
