# Official documentation compatibility audit — 2026-11-07

Status: **PARTIAL; no production approval.** Scope: standalone PayFast, Whop, SWICH and HighLevel Marketplace payment-provider integration.

## HighLevel v3 — verified

- Version header `Version: v3` is supported on custom provider create, connect and capabilities endpoints. These routes remain `/payments/custom-provider/provider`, `/payments/custom-provider/connect`, `/payments/custom-provider/capabilities`; **do not prepend `/v3` to these paths** without endpoint-specific evidence.
- Provider creation: POST, `locationId` query, body `name,description,paymentsUrl,queryUrl,imageUrl,supportsSubscriptionSchedule`. Removed redundant `locationId` from creation bodies.
- Connection: POST, `locationId` query, body `live` and `test` key objects. Removed undocumented `liveMode` body property in PayFast provisioner.
- Capabilities: PUT, body `supportsSubscriptionSchedules` and `locationId` or `companyId`.
- Migrated three standalone provisioning clients from `Version: 2021-07-28` to `Version: v3`. Standalone OAuth code exchanges and refresh calls now send `Version: v3`, per official `POST /oauth/token` contract. Legacy combined app, other GHL API surfaces, notifications and end-to-end compatibility are **not certified**.
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

## Additional review: HighLevel OAuth v3, Marketplace SSO and standalone checkout (2026-11-07)

### Documented GHL OAuth token request
- `POST https://services.leadconnectorhq.com/oauth/token` requires header `Version: v3`, body `application/x-www-form-urlencoded` with `client_id`, `client_secret`, `grant_type`, and either `code` (authorization code) or `refresh_token`. `redirect_uri` is supported.
- v3 response includes `access_token`, `refresh_token`, `expires_in` and `locationId` for a Sub-Account token. Three standalone callbacks derive tenant context from this response, not URL query fallbacks.
- The above version header is now added to PayFast, Whop and SWICH callback exchanges and refreshers. Test suites cover v3 refresh and custom-provider calls, but are **not executed**.
- Official reference: https://marketplace.gohighlevel.com/docs/ghl/oauth/get-access-token/

### Marketplace custom page identity contract (critical)
- A Custom Page is embedded in a HighLevel iframe; URL placeholders such as `{{location.id}}` supply **context**, not authenticated authorization.
- HighLevel's documented secure Custom Page flow sends a `REQUEST_USER_DATA` parent `postMessage`, receives `REQUEST_USER_DATA_RESPONSE` with `encryptedData`, and validates/decrypts it on the backend using the per-app Shared Secret. The trusted decrypted `activeLocation` and user identity are used for authorization.
- Our standalone settings pages currently read `?locationId=` and call APIs gated by the legacy `pf_session` cookie. This cannot be considered compatible or secure GHL Marketplace SSO until the official signed user-context flow is integrated and browser iframe cookie behavior is tested.
- The source origin and `event.source` should also be validated where feasible, taking actual HighLevel and whitelabel domains into account.
- References:
  - https://marketplace.gohighlevel.com/docs/marketplace-modules/CustomPages/index.html
  - https://marketplace.gohighlevel.com/docs/2021-07-28/other/user-context-marketplace-apps/index.html

### Checkout isolation and callback origins
- Standalone `app/apps/whop/checkout/page.tsx` currently re-exports the merged `app/checkout/page.tsx`; merged page allows both PayFast and Whop selection. This violates intended app-specific checkout isolation. SWICH has a separate checkout page.
- Both PayFast and SWICH return popups previously sent `postMessage` to `'*'`; they now use only the trusted `NEXT_PUBLIC_APP_URL` origin and fail closed if it is unconfigured or unsafe. This does **not** fix inbound iframe event source validation; separate work needed.
- The original `app/checkout/page.tsx` and SWICH standalone checkout currently accept `payment_initiate_props` from unverified `message` senders. This is an authorization and integrity risk; do not fix by hardcoding a single GHL domain without checking supported whitelabel deployment.
- Regression tests added for cancellation redirects and popup origin, plus contract tests for GHL v3 provisioning and OAuth refresh; CI results remain unverified.
- HighLevel workflow: https://marketplace.gohighlevel.com/docs/marketplace-modules/Payments/

### Legacy services remain
- `lib/ghl.ts` and `app/oauth/callback/route.ts` belong to the legacy combined app and still use previous header/no header patterns. Route-specific compatibility analysis and backward-compatible rollout are required before updating production users.
- Do not infer that every GHL endpoint can be migrated by simply adding a `/v3` URL prefix. Consult its individual v3 reference and test request/response behavior.

## Implementation update: Marketplace admin SSO + Whop standalone checkout (2026-11-07)

### Marketplace SSO code (not yet integration-tested)
- Added `lib/marketplace-sso.ts` to decrypt the documented CryptoJS OpenSSL-compatible AES-256-CBC passphrase ciphertext **on the backend only**, with each app's separate `*_GHL_SHARED_SECRET`.
- Added `POST /api/marketplace/session`: validates same-origin browser request; decrypts SSO; requires GHL `role=admin`, active location, matched OAuth installation and matching company if present; issues a 15-minute provider/location-scoped HS256 token with separate key derivation, issuer and audience.
- Updated PayFast/Whop/SWICH custom settings pages to request GHL `REQUEST_USER_DATA_RESPONSE`, then use provider/location-scoped bearer tokens for API GET/POST rather than third-party cookies. Admin settings opened outside GHL iframe fail closed; legacy cookie path remains temporarily for legacy sessions.
- Warning: HighLevel SSO context is encrypted using a documented CryptoJS format with no independently verified freshness/nonce binding. Replay, iframe-origin absence/whitelabel variations, subaccount permission differences and actual SSO fixture tests are outstanding.
- References: https://marketplace.gohighlevel.com/docs/2021-07-28/other/user-context-marketplace-apps/index.html ; https://marketplace.gohighlevel.com/docs/marketplace-modules/CustomPages/index.html

### Whop-only checkout code (not yet payment-tested)
- Replaced `app/apps/whop/checkout/page.tsx` shared export with an isolated Whop-only checkout. Supports payment and setup initiation messages, recurring-plan initiation, hosted checkout popup, webhook-backed status polling, and completion/cancel/error responses. The page checks message source against `window.parent` and referrer origin when present.
- `POST /api/apps/whop/pay` and `/setup` now require the location's registered public provider key; setup additionally issues random status token. `GET /api/apps/whop/status` returns minimal statuses only when provider, location, basket and random token match. The status endpoint never updates payment state.
- **Integrity gate:** `lib/ghl-whop-order-attestation.ts` calls GHL API v3 `GET /payments/orders/{orderId}?altId={locationId}&locationId={locationId}` with the installed app's sub-account OAuth token. Checks order ID, location, contact (where present), currency, amount and paid status. Missing `orderId` fails closed to prevent arbitrary browser amounts. This may block channels that don't expose a GHL order ID; test all channel payloads before deployment.
- Pending: GHL transaction-to-order binding, duplicated checkout idempotency, signed Whop webhook amount/currency and event mapping fixtures, GHL partial payments/refunds, subscriptions/renewals, setup method persistence, official live/sandbox compatibility, build & Jest execution.
- Reference: https://marketplace.gohighlevel.com/docs/ghl/payments/get-order-by-id/index.html ; https://marketplace.gohighlevel.com/docs/marketplace-modules/Payments/

All changes are on `audit/security-hardening-2026-11`. No merge, deployment, live transaction or passing-test claim.
