#!/usr/bin/env bash
set -euo pipefail

# CI-only verification against a disposable MySQL test database.
# Never run nonce replay fixtures against the production database.
: "${DB_HOST:?DB_HOST required}"
: "${DB_USER:?DB_USER required}"
: "${DB_NAME:?DB_NAME required}"
DB_PORT="${DB_PORT:-3306}"
export MYSQL_PWD="${DB_PASSWORD:-}"

mysql_args=(--host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --database="$DB_NAME" --batch --skip-column-names)

# A deployment should be able to apply the same migration more than once.
mysql "${mysql_args[@]}" < scripts/gateway-oauth-nonces.sql
mysql "${mysql_args[@]}" < scripts/gateway-oauth-nonces.sql

# Assert schema and uniqueness/replay behavior, not only SQL parsing.
columns="$(mysql "${mysql_args[@]}" -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'gateway_oauth_nonces' AND column_name IN ('nonce_sha256', 'provider', 'expires_at', 'consumed_at');")"
test "$columns" = "4"

nonce='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
mysql "${mysql_args[@]}" -e "DELETE FROM gateway_oauth_nonces WHERE nonce_sha256='$nonce'; INSERT INTO gateway_oauth_nonces (nonce_sha256, provider, expires_at) VALUES ('$nonce', 'payfast', DATE_ADD(NOW(), INTERVAL 10 MINUTE));"

first="$(mysql "${mysql_args[@]}" -e "UPDATE gateway_oauth_nonces SET consumed_at=NOW() WHERE nonce_sha256='$nonce' AND provider='payfast' AND consumed_at IS NULL AND expires_at > NOW(); SELECT ROW_COUNT();")"
second="$(mysql "${mysql_args[@]}" -e "UPDATE gateway_oauth_nonces SET consumed_at=NOW() WHERE nonce_sha256='$nonce' AND provider='payfast' AND consumed_at IS NULL AND expires_at > NOW(); SELECT ROW_COUNT();")"
mysql "${mysql_args[@]}" -e "DELETE FROM gateway_oauth_nonces WHERE nonce_sha256='$nonce';"
test "$first" = "1"
test "$second" = "0"

echo "Gateway OAuth migration replay and atomic one-time nonce consume verified."
