# PayFast Connect — Audit, Remediation & Verification Plan
Baseline: main branch, 2026-11-07. Scope: PayFast, Whop, SWICH standalone HighLevel Marketplace apps.
Current main security baseline: Next.js 16.4.5 and React 19.3.1 merged via PR #25 (0ca7c9f); full payment integration PR #23 remains draft and is not merged.
Status definitions: OPEN / IN PROGRESS / FIXED UNVERIFIED / VERIFIED / BLOCKED. Never mark VERIFIED without a test or review artifact.

## Ground rules
- Continue remaining integrations only on audit/security-hardening-2026-11 until verified. PR #24 PayFast cancellation and PR #25 Next16 dependency upgrade were explicitly approved and merged to main; never modify live production credentials.
- Preserve original baseline and track file/commit, reproduction, fix, regression tests, and second independent review for every finding.
- Avoid real payment transactions or live deployment without explicit approval and sandbox credentials.
- Do not claim full-repository audit or passing tests until actually run.

## Finding register
| ID | Priority | Finding / evidence | Required acceptance criteria | Status |
|---|---|---|---|---|
| SEC-01 | Critical | Standalone GHL OAuth callback state correlation not enforced; removed query-only location fallbacks | Verify actual GHL Marketplace installation entrypoint: native install-link docs show code callback without guaranteed state; implement provider-bound one-time state only when install initiation controls it; callback/nonce tests | IN PROGRESS — controlled start route /oauth/{provider}/start, 10-min signed provider state, browser-bound HttpOnly nonce and atomic MySQL consume wired into all three callbacks (aa299f1..0bcbed4); Jest tests, Next.js build, rollout and dependency-audit all PASSED in CI run 42479221724. Native GHL install link may return code only, so compatibility fallback remains and cannot be considered fully CSRF-protected until HighLevel state contract/sandbox confirms enforcement |
| SEC-05 | Critical | app/auth/launch/route.ts trusts URL location/company IDs without verified user identity; applySessionCookie invocation mismatches lib/session.ts signature | Require verified GHL signed launch/session or authenticated identity; reject unauthenticated restore; regression tests for forged location/company and valid launch | FIXED / CI TESTED — fail-closed session route and forged-location tests passed in run 42377044904; real HighLevel passwordless launch and session UX still require sandbox verification |
| SEC-02 | Critical | PayFast, Whop, SWICH app/api/apps/*/config/route.ts exposed secrets by locationId alone and accepted writes without authentication | Server-side authenticated location membership; deny cross-location read/write; tests | FIXED / CI TESTED — all config GET/POST routes are location-gated, with provider-bound bearer and regression tests green in run 42377044904; HighLevel iframe SSO sandbox check pending |
| SEC-03 | High | OAuth and merchant/provider secrets stored in installation tables; settings GET returned plaintext merchant keys, webhook secrets and SWICH keys | Verify encryption at rest, data lifecycle, logging and cryptographic key rotation; mask secrets on GET and retain on blank POST | IN PROGRESS — PayFast/Whop/SWICH GET no longer select or echo raw secrets; UI saved-key hints and POST retain-or-rotate implemented with tests (1d45207, 7b15e75, c35a508); application-layer encryption at rest and live verification pending |
| PAY-01 | High | app/api/apps/payfast/itn/route.ts unsigned browser cancellation can change payment state | Browser redirects cannot authoritatively transition payment; signed server callback reconciliation and tests | MERGED & CI VERIFIED — isolated hotfix PR #24 merged to main bb0fc82; regression and build passed; PayFast gateway ITN integration remains unverified |
| PAY-02 | High | PayFast and SWICH callback popups sent postMessage to wildcard '*' | Strict known origin and receiver validation | IN PROGRESS — sender now pins configured HTTPS app origin (75c1f4c, 792395a, 1904885); receiver source/origin validation and tests still pending |
| REL-01 | High | PayFast/Whop/SWICH notification claim synced_ghl=-1 can become stuck | Durable retry queue, recover stale claims, classify terminal failures, tests | OPEN |
| DB-01 | High | Whop SQL migrations used unsupported MySQL 8 ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS syntax and risked overwriting standalone Whop settings | Metadata-guarded idempotent DDL; run both migrations twice on MySQL 8; preserve legacy-only backfill | VERIFIED IN CI — scripts/verify-whop-migrations.sh ran twice with columns/indexes checked; run 42377044904 tests, build, rollout, dependency audit passed; production DB still requires backup/dry-run |
| SEC-04 | Medium | lib/*-ghl-token.ts refresh logic lacks visible concurrency control | Race-safe token refresh and rotation tests | OPEN |
| SWI-01 | Blocker | SWICH merchant-specific official API/checksum/status contract not confirmed | Official provider fixture validation and sandbox approval | BLOCKED |
| QA-01 | High | scripts/verify-gateway-rollout.mjs checks files/env only | CI build, unit/integration tests, signed webhook fixtures, GHL sandbox end-to-end | IN PROGRESS — PR #23 tests, Next16 build, MySQL migration replay, rollout and dependency audit passed in run 42377044904; gateway sandbox, signed production fixtures and Hostinger deployed scan pending |
| ARCH-01 | Medium | Legacy combined routes retained | Verify isolation, migration compatibility, deprecation plan | OPEN |
| GHL-01 | High | Standalone settings pages relied on legacy pf_session; Marketplace context provides per-app encrypted SSO payload | Decrypt app-specific SSO, enforce role/activeLocation/installation, scoped bearer; verify real iframe/whitelabel behavior and replay exposure | FIXED UNVERIFIED — server SSO endpoint, admin/location-bound token and three settings pages committed; tests authored but not executed |
| GHL-02 | High | OAuth token/provisioning version headers were legacy/absent | Version v3 on documented standalone OAuth token exchange/refresh and provider API, integration/sandbox tests | FIXED UNVERIFIED — standalone headers migrated; v3 request contract Jest tests added but not executed |
| GHL-03 | High | Checkout event receivers accept payment_initiate_props without validating message sender | Verify allowed HighLevel parent origins, event.source and tenant binding without breaking documented whitelabel iframe flow | IN PROGRESS — Whop standalone checkout now checks parent source and referrer origin where supplied; PayFast/SWICH still pending |
| ARCH-02 | High | Whop standalone checkout re-exported shared PayFast/Whop checkout and merged routing | Whop-only iframe, hosted payment/setup, server-side order attestation, webhook-gated status, end-to-end integration tests | FIXED UNVERIFIED — dedicated checkout and Whop-specific status endpoint added; sandbox, subscriptions and refund compliance pending |
| PAY-03 | High | PayFast ITN verifies signature but does not reconcile callback amount/currency against stored charge or provider transaction | Obtain official Pakistan IPG callbacks/verification contract; fail closed on mismatches; signed fixtures and sandbox results | OPEN |
| WHOP-01 | High | Hosted checkout previously trusted browser amount, location and GHL transaction context | Validate GHL order identity/currency/amount via authenticated v3 order API; ensure transaction-to-order binding, idempotency and sandbox coverage | IN PROGRESS — v3 order attestation + MySQL GET_LOCK serialized checkout creation + deny any existing order (9ccd5e1, b4ba3eb); transaction binding, one-time failure recovery and sandbox still pending |
| WHOP-02 | High | Whop webhook parsing, subscription renewals, card setup success, partial refunds and GHL receipts not yet proven against official fixtures | Whop-signed webhook fixture coverage, amount verification, idempotent renewals/refunds and GHL integration tests | OPEN |



## Work sequence
1. Inventory repository tree, dependencies, CI, current deployment and existing tests. Record baseline commit and actual execution results.
2. SEC-05 session launch identity and SEC-01 OAuth state flow: inspect install initiators; implement shared secure state service and provider-specific callback validation; add negative tests; independent re-review.
3. SEC-02 settings API authorization after SEC-05 verified; SEC-03 credential handling; SEC-04 refresh concurrency.
4. PAY-01 and PAY-02 payment browser/callback security; verify provider signatures and amounts.
5. REL-01 durable notification delivery and idempotent reconciliation.
6. DB-01 migration compatibility and rollback safety.
7. Gateway-by-gateway functionality: PayFast then Whop then SWICH (SWI-01 dependent on merchant docs).
8. QA-01 CI, sandbox flows, GHL payment receipts and independent second-pass security review.
9. Only after all critical/high issues verified and required external approvals, prepare reviewable PR; production rollout separately approved.

## Per-fix evidence template
- ID / original file and line / reproduction
- Change commit and exact files
- Tests executed, commands, environment and results
- Second-pass review against original evidence
- Residual risks / sign-off
