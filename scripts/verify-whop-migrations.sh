#!/usr/bin/env bash
# Run against an isolated MySQL 8 test database only. The CI job initializes
# tables first; this verifies that standalone Whop migration files work on a
# fresh DB and can be rerun without changing existing schema or credentials.
set -euo pipefail
: "${DB_NAME:?DB_NAME must point to the disposable test database}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
export MYSQL_PWD="$DB_PASSWORD"
mysql_args=(--host="${DB_HOST:-127.0.0.1}" --port="${DB_PORT:-3306}" --user="$DB_USER" "$DB_NAME")
for attempt in 1 2; do
  mysql "${mysql_args[@]}" < scripts/whop-ghl-app.sql
  mysql "${mysql_args[@]}" < scripts/whop-standalone-app.sql
  mysql "${mysql_args[@]}" < scripts/whop-ghl-provider-compliance-migration.sql
done

columns=$(mysql "${mysql_args[@]}" --batch --skip-column-names -e "
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND
   ((TABLE_NAME='whop_ghl_installations' AND COLUMN_NAME IN
    ('whop_api_key','whop_company_id','whop_webhook_secret','whop_rate_mode',
     'whop_exchange_rate','whop_fee_percent','whop_currency','provider_api_key','provider_publishable_key'))
    OR
    (TABLE_NAME='payment_instruments' AND COLUMN_NAME IN
    ('contact_id','provider','provider_customer_id','provider_payment_method_id')))")
if [[ "$columns" != "13" ]]; then
  echo "Unexpected migrated Whop column count: $columns (expected 13)" >&2
  exit 1
fi

indexes=$(mysql "${mysql_args[@]}" --batch --skip-column-names -e "
  SELECT COUNT(DISTINCT CONCAT(TABLE_NAME,'.',INDEX_NAME))
  FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND (
  (TABLE_NAME='payment_instruments' AND INDEX_NAME IN
    ('idx_payment_instruments_contact','idx_payment_instruments_provider_method'))
  OR
  (TABLE_NAME='payments' AND INDEX_NAME IN
    ('idx_payments_ghl_verify','idx_payments_contact_provider')))")
if [[ "$indexes" != "4" ]]; then
  echo "Unexpected migrated Whop index count: $indexes (expected 4)" >&2
  exit 1
fi
echo "MySQL8 Whop migrations passed twice; 13 columns, 4 indexes present."
