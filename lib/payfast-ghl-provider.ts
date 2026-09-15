import crypto from 'crypto';
import { query } from './db';
import { getValidPayfastToken } from './payfast-ghl-token';

const GHL_API = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';
function appUrl(path: string) { return `${(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')}${path}`; }
async function ghlRequest(path: string, token: string, method: 'POST' | 'PUT', body: unknown) {
  const response = await fetch(`${GHL_API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, Version: VERSION,
    'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  const text = await response.text(); let data: any = text;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(`${response.status} ${typeof data === 'string' ? data : data?.message || data?.error || 'GHL request failed'}`);
  return data;
}
async function ensureKeys(locationId: string) {
  const rows = await query<any[]>('SELECT provider_api_key,provider_publishable_key FROM payfast_ghl_installations WHERE location_id=? LIMIT 1', [locationId]);
  const apiKey = rows[0]?.provider_api_key || `sk_${crypto.randomBytes(24).toString('hex')}`;
  const publishableKey = rows[0]?.provider_publishable_key || `pk_${crypto.randomBytes(16).toString('hex')}`;
  await query('UPDATE payfast_ghl_installations SET provider_api_key=?,provider_publishable_key=? WHERE location_id=?', [apiKey, publishableKey, locationId]);
  return { apiKey, publishableKey };
}
export async function provisionPayfastProvider(locationId: string, mode: 'live' | 'test') {
  const token = await getValidPayfastToken(locationId);
  if (!token) return { ok: false, reason: 'missing_payfast_app_token' as const };
  try {
    const provider = await ghlRequest(`/payments/custom-provider/provider?${new URLSearchParams({ locationId })}`, token, 'POST', {
      name: 'PayFast Connect by 10x Digital Ventures', description: 'Dedicated PayFast Pakistan payment provider', locationId,
      paymentsUrl: appUrl('/apps/payfast/checkout'),
      queryUrl: `${appUrl('/api/apps/payfast/query')}?locationId=${encodeURIComponent(locationId)}`,
      imageUrl: process.env.PAYFAST_GHL_PROVIDER_LOGO_URL || appUrl('/logo.png'), supportsSubscriptionSchedule: true,
    });
    const keys = await ensureKeys(locationId); const providerConfig = { apiKey: keys.apiKey, publishableKey: keys.publishableKey };
    const connection = await ghlRequest(`/payments/custom-provider/connect?${new URLSearchParams({ locationId })}`, token, 'POST',
      { live: providerConfig, test: providerConfig, liveMode: mode === 'live' });
    const capabilities = await ghlRequest('/payments/custom-provider/capabilities', token, 'PUT',
      { supportsSubscriptionSchedules: true, locationId });
    return { ok: true, provider, connection, capabilities };
  } catch (error) {
    console.error('[PayFast App] provider provisioning failed', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
