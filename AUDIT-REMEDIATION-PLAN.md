# PayFast Connect — Audit, Remediation & Verification Plan
Baseline: main branch, 2026-11-07. Scope: PayFast, Whop, SWICH standalone HighLevel Marketplace apps.
Status definitions: OPEN / IN PROGRESS / FIXED UNVERIFIED / VERIFIED / BLOCKED. Never mark VERIFIED without a test or review artifact.

## Ground rules
- Work only on audit/security-hardening-2026-11 until reviewed; do not modify main or production credentials.
- Preserve original baseline and track file/commit, reproduction, fix, regression tests, and second independent review for every finding.
- Avoid real payment transactions or live deployment without explicit approval and sandbox credentials.
- Do not claim full-repository audit or passing tests until actually run.

## Finding register
| ID | Priority | Finding / evidence | Required acceptance criteria | Status |
|---|---|---|---|---|
| SEC-01 | Critical | All three app/oauth/*/callback/route.ts handlers lack visible OAuth state verification | Cryptographic one-time state bound to provider/session and expiry; reject absent/replayed/mismatched state; tests | OPEN |
| SEC-05 | Critical | app/auth/launch/route.ts trusts URL location/company IDs without verified user identity; applySessionCookie invocation mismatches lib/session.ts signature | Require verified GHL signed launch/session or authenticated identity; reject unauthenticated restore; regression tests for forged location/company and valid launch | FIXED UNVERIFIED — fail-closed session route committed 82929da; GHL SSO and tests pending |
| SEC-02 | Critical | PayFast, Whop, SWICH app/api/apps/*/config/route.ts exposed secrets by locationId alone and accepted writes without authentication | Server-side authenticated location membership; deny cross-location read/write; tests | FIXED UNVERIFIED — all three GET/POST handlers gated by session location; Marketplace session integration and tests pending |
| SEC-03 | High | OAuth and provider credentials stored in installation tables; application encryption not yet verified | Verify encryption at rest and application secret handling; never echo secrets | OPEN |
| PAY-01 | High | app/api/apps/payfast/itn/route.ts unsigned browser cancellation can change payment state | Browser redirects cannot authoritatively transition payment; signed server callback reconciliation and tests | OPEN |
| PAY-02 | High | app/api/apps/payfast/itn/route.ts and swich callback use postMessage target '*' | Strict known origin and receiver validation | OPEN |
| REL-01 | High | PayFast/Whop/SWICH notification claim synced_ghl=-1 can become stuck | Durable retry queue, recover stale claims, classify terminal failures, tests | OPEN |
| DB-01 | High | scripts/whop-standalone-app.sql and whop-ghl-provider-compliance-migration.sql use ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS | MySQL-compatible idempotent migration verified on actual version | OPEN |
| SEC-04 | Medium | lib/*-ghl-token.ts refresh logic lacks visible concurrency control | Race-safe token refresh and rotation tests | OPEN |
| SWI-01 | Blocker | SWICH merchant-specific official API/checksum/status contract not confirmed | Official provider fixture validation and sandbox approval | BLOCKED |
| QA-01 | High | scripts/verify-gateway-rollout.mjs checks files/env only | CI build, unit/integration tests, signed webhook fixtures, GHL sandbox end-to-end | OPEN |
| ARCH-01 | Medium | Legacy combined routes retained | Verify isolation, migration compatibility, deprecation plan | OPEN |

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
