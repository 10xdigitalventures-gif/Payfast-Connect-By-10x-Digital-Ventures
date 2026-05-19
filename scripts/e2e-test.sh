#!/usr/bin/env bash
# Simple E2E test script (requires jq and curl)

set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:3000}
API_KEY=${API_KEY:-}
LOCATION_ID=${LOCATION_ID:-test-loc}
CONTACT_ID=${CONTACT_ID:-contact-123}

echo "Using BASE_URL=$BASE_URL"

echo "1) Install (simulate)"
curl -sSf -X POST "$BASE_URL/api/provider/query" -H "Content-Type: application/json" -d '{"type":"INSTALL","locationId":"'$LOCATION_ID'"}' | jq .

echo "2) Save merchant config (simulate)"
curl -sSf -X POST "$BASE_URL/api/provider/config" -H "Content-Type: application/json" -d '{"locationId":"'$LOCATION_ID'","merchant_id":"m123","merchant_key":"k123","environment":"sandbox"}' | jq .

echo "3) Attempt list_payment_methods (should 401 without API key)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/provider/query" -H "Content-Type: application/json" -d '{"type":"list_payment_methods","locationId":"'$LOCATION_ID'"}' || true

if [ -n "$API_KEY" ]; then
  echo "4) Attempt list_payment_methods with API key"
  curl -sSf -X POST "$BASE_URL/api/provider/query" -H "Content-Type: application/json" -H "X-API-KEY: $API_KEY" -d '{"type":"list_payment_methods","locationId":"'$LOCATION_ID'"}' | jq .
fi

echo "E2E script finished"
