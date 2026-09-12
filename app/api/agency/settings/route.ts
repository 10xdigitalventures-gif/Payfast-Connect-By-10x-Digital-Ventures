import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';
import { getAgencySettings } from '@/lib/billing';

const allowedEnvironments = new Set(['live', 'sandbox']);
const allowedProviders = new Set(['payfast', 'swich', 'whop']);

function clean(value: unknown) { const result = String(value ?? '').trim(); return result || null; }

export async function GET() {
  const session = await getSession();
  if (!session || session.installMode !== 'agency') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await getAgencySettings();
  if (!settings) return NextResponse.json(null);
  const sanitized = { ...settings,
    merchant_key: '', passphrase: '', sandbox_merchant_key: '', sandbox_passphrase: '',
    swich_live_secret_key: '', swich_sandbox_secret_key: '', whop_api_key: '', whop_webhook_secret: '',
    has_merchant_key: Boolean(settings.merchant_key), has_passphrase: Boolean(settings.passphrase),
    has_sandbox_merchant_key: Boolean(settings.sandbox_merchant_key), has_sandbox_passphrase: Boolean(settings.sandbox_passphrase),
    has_swich_live_secret_key: Boolean(settings.swich_live_secret_key), has_swich_sandbox_secret_key: Boolean(settings.swich_sandbox_secret_key),
    has_whop_api_key: Boolean(settings.whop_api_key), has_whop_webhook_secret: Boolean(settings.whop_webhook_secret),
  };
  return NextResponse.json(sanitized);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.installMode !== 'agency') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const current = (await getAgencySettings()) || {};
  const environment = allowedEnvironments.has(String(body.environment)) ? String(body.environment) : 'live';
  const provider = allowedProviders.has(String(body.route_subscription)) ? String(body.route_subscription) : 'payfast';
  const secret = (name: string) => clean(body[name]) || current[name] || null;

  await query(`INSERT INTO agency_settings (id, environment) VALUES (1, ?) ON DUPLICATE KEY UPDATE id = id`, [environment]);
  await query(
    `UPDATE agency_settings SET
      merchant_id=?, merchant_key=?, merchant_name=?, store_id=?, passphrase=?,
      sandbox_merchant_id=?, sandbox_merchant_key=?, sandbox_merchant_name=?, sandbox_store_id=?, sandbox_passphrase=?,
      environment=?, route_subscription=?, grace_period_days=?, trial_days=?, notify_email=?,
      swich_live_client_id=?, swich_live_secret_key=?, swich_live_checkout_url=?,
      swich_sandbox_client_id=?, swich_sandbox_secret_key=?, swich_sandbox_checkout_url=?,
      whop_api_key=?, whop_company_id=?, whop_webhook_secret=?,
      whop_exchange_rate=?, whop_fee_percent=?, whop_rate_mode=?, whop_currency=?
     WHERE id=1`,
    [
      clean(body.merchant_id) || current.merchant_id || null, secret('merchant_key'), clean(body.merchant_name) || current.merchant_name || null,
      clean(body.store_id), secret('passphrase'), clean(body.sandbox_merchant_id) || current.sandbox_merchant_id || null,
      secret('sandbox_merchant_key'), clean(body.sandbox_merchant_name) || current.sandbox_merchant_name || null,
      clean(body.sandbox_store_id), secret('sandbox_passphrase'), environment, provider,
      Number(body.grace_period_days ?? current.grace_period_days ?? 3), Number(body.trial_days ?? current.trial_days ?? 14),
      clean(body.notify_email), clean(body.swich_live_client_id) || current.swich_live_client_id || null, secret('swich_live_secret_key'),
      clean(body.swich_live_checkout_url) || current.swich_live_checkout_url || null,
      clean(body.swich_sandbox_client_id) || current.swich_sandbox_client_id || null, secret('swich_sandbox_secret_key'),
      clean(body.swich_sandbox_checkout_url) || current.swich_sandbox_checkout_url || null,
      secret('whop_api_key'), clean(body.whop_company_id) || current.whop_company_id || null, secret('whop_webhook_secret'),
      Number(body.whop_exchange_rate ?? current.whop_exchange_rate ?? 280), Number(body.whop_fee_percent ?? current.whop_fee_percent ?? 0),
      clean(body.whop_rate_mode) || current.whop_rate_mode || 'fixed', clean(body.whop_currency) || current.whop_currency || 'PKR',
    ]
  );

  await query(`CREATE TABLE IF NOT EXISTS agency_legal_links (id INT AUTO_INCREMENT PRIMARY KEY, terms_url VARCHAR(1000) NULL, privacy_policy_url VARCHAR(1000) NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await query(`INSERT INTO agency_legal_links (id, terms_url, privacy_policy_url) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE terms_url=VALUES(terms_url), privacy_policy_url=VALUES(privacy_policy_url)`, [clean(body.terms_url), clean(body.privacy_policy_url)]);
  return NextResponse.json({ success: true, environment, provider });
}
