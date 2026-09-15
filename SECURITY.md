# Security Policy and Deployment Requirements

## Credential handling
- The settings API requires a valid signed session; preview/demo query parameters do not bypass authentication.
- Stored password hashes are never returned by an API.
- Gateway secrets are scoped to a provider-specific installation table and location.
- Credential responses use `Cache-Control: private, no-store`.
- Never commit live credentials, access tokens, webhook secrets, session secrets, or database passwords.

## Session requirements
- `SESSION_SECRET` must be a random value of at least 32 characters.
- Production cookies are HTTP-only, Secure, SameSite=Lax, and have an explicit expiry.
- Agency pages require an agency-role JWT; subaccount sessions are rejected.

## Payment endpoints
- Verify gateway signatures/checksums before changing payment state.
- Use atomic pending-to-terminal transitions and one-time GHL notification claims.
- HighLevel terminal browser messages must be JSON strings.
- Public payment status responses must contain only minimal status and charge identifiers.

## Reporting
If a credential may have been exposed, rotate it immediately, inspect provider and server logs, and invalidate related sessions/tokens before investigating further.
