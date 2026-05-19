Agency Proxy API
================

Summary
-------
These routes are proxy endpoints intended for agency installations. They forward requests to internal GHL/backend services using the agency installation's OAuth token and normalize responses for the frontend.

Location
--------
- app/api/agency/transactions/company/[companyId]/route.ts  (GET)
- app/api/agency/transactions/location/[locationId]/route.ts (GET)
- app/api/agency/wallet/location/[locationId]/route.ts     (GET)
- app/api/agency/wallet/company-charges/route.ts           (GET)

Authentication & Ownership
--------------------------
- All endpoints require an active agency session (getSession() && installMode === 'agency').
- The agency installation must exist in the installations table (SELECT company_id FROM installations WHERE location_id = ?).
- The agency installation must be associated with a company (installations.company_id). If not associated, endpoints return 403.
- Company endpoints require the requested companyId to match installations.company_id (403 otherwise).
- Location endpoints require the target location to exist and belong to the same company as the agency installation (404 if target missing, 403 if cross-company).

Request Query Parameters
------------------------
- page, per_page (or pageNumber / perPage / limit): pagination parameters (defaults: page=1, per_page=50).
- date_from / date_to (or from / to): optional date filters forwarded to upstream.
- Any additional query params are forwarded to the upstream service unchanged.

Response Shape
--------------
All endpoints return a normalized object:

{
  "total": <number>,
  "page": <number>,
  "per_page": <number>,
  "items": [ /* array of records */ ]
}

Notes:
- If the upstream already provides pagination metadata (total, page, per_page), the proxy preserves and returns those values.
- If upstream returns an array, the proxy will paginate locally based on page/per_page.
- Errors from upstream are proxied as JSON: { error: string } with the upstream HTTP status.

Examples
--------
Fetch company transactions (page 2, 25 per page):

curl -H "Cookie: <session cookie>" "https://your-app.example.com/api/agency/transactions/company/123?page=2&per_page=25"

Fetch wallet charges for a location owned by the company:

curl -H "Cookie: <session cookie>" "https://your-app.example.com/api/agency/wallet/location/loc_abc?date_from=2024-01-01&date_to=2024-01-31"

Caching & Performance
---------------------
- Consider a short TTL cache (e.g. 30s) for high-traffic endpoints (wallet / transactions) to reduce upstream load.
- Alternatives: set Cache-Control headers and rely on CDN caching where appropriate.

Security Recommendations
------------------------
- Enforce strict ownership checks (already implemented) so agency sessions cannot query other companies or locations.
- Add request-level rate limiting for agency routes to avoid accidental scraping of upstream services.

Next Steps
----------
1. Add response metadata: links (next/prev) and has_more boolean for easier UI paging.
