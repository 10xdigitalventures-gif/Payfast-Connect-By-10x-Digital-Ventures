import crypto from 'crypto';
import { getValidToken } from './ghl';
import { query } from './db';

const GHL_API = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';
const PROVIDER_NAME = 'Payfast Connect by 10x Digital Ventures';
const PROVIDER_DESCRIPTION = 'CRM-native PayFast payment connector';

function appUrl(path: string) { return `${(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')}${path}`; }
async function ghlRequest(path: string, token: string, method: 'GET'|'POST'|'PUT'|'DELETE', body?: unknown) {
  const res = await fetch(`${GHL_API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, Version: VERSION,
    'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let data: any = text;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(`${res.status} ${typeof data === 'string' ? data : data?.message || data?.error || 'GHL request failed'}`);
  return data;
}

async function ensureProviderKeys(locationId: string) {
  const rows = await query<any[]>('SELECT provider_api_key,provider_publishable_key FROM installations WHERE location_id=? LIMIT 1', [locationId]);
  let apiKey = rows[0]?.provider_api_key || ''; let publishableKey = rows[0]?.provider_publishable_key || '';
  if (!apiKey) apiKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
  if (!publishableKey) publishableKey = `pk_${crypto.randomBytes(16).toString('hex')}`;
  await query('UPDATE installations SET provider_api_key=?,provider_publishable_key=? WHERE location_id=?', [apiKey, publishableKey, locationId]);
  return { apiKey, publishableKey };
}

export async function registerProviderForLocation(locationId: string, _appType: 'normal'|'agency' = 'normal') {
  const token = await getValidToken(locationId); if (!token) return { ok: false, reason: 'missing_token' as const };
  const queryUrl = `${appUrl('/api/ghl/query-v2')}?locationId=${encodeURIComponent(locationId)}`;
  const body = { name: PROVIDER_NAME, description: PROVIDER_DESCRIPTION, locationId, paymentsUrl: appUrl('/checkout'), queryUrl,
    imageUrl: process.env.GHL_PROVIDER_LOGO_URL || appUrl('/logo.png'), supportsSubscriptionSchedule: true };
  try { const response = await ghlRequest(`/payments/custom-provider/provider?${new URLSearchParams({ locationId })}`, token, 'POST', body);
    return { ok: true, response }; } catch (error) { console.error('[GHL Provider] register failed', error); return { ok: false, error: String(error) }; }
}

export async function connectProviderConfig(locationId: string, _mode: 'live'|'test' = 'live', _appType: 'normal'|'agency' = 'normal') {
  const token = await getValidToken(locationId); if (!token) return { ok: false, reason: 'missing_token' as const };
  try { const keys = await ensureProviderKeys(locationId); const config = { apiKey: keys.apiKey, publishableKey: keys.publishableKey };
    const response = await ghlRequest(`/payments/custom-provider/connect?${new URLSearchParams({ locationId })}`, token, 'POST', { live: config, test: config });
    return { ok: true, response, ...keys }; } catch (error) { console.error('[GHL Provider] connect failed', error); return { ok: false, error: String(error) }; }
}

export async function updateProviderCapabilities(locationId: string, _appType: 'normal'|'agency' = 'normal') {
  const token = await getValidToken(locationId); if (!token) return { ok: false, reason: 'missing_token' as const };
  try { const response = await ghlRequest('/payments/custom-provider/capabilities', token, 'PUT', { supportsSubscriptionSchedules: true, locationId });
    return { ok: true, response }; } catch (error) { console.error('[GHL Provider] capabilities failed', error); return { ok: false, error: String(error) }; }
}

export async function disconnectCustomProvider(locationId: string, mode: 'live'|'test' = 'live', _appType: 'normal'|'agency' = 'normal') {
  const token = await getValidToken(locationId); if (!token) throw new Error('Missing token for disconnect');
  await ghlRequest(`/payments/custom-provider/disconnect?${new URLSearchParams({ locationId })}`, token, 'POST', { liveMode: mode === 'live' });
  return { ok: true };
}

export async function ensureCustomProviderProvisioned(locationId: string, options?: { appType?: 'normal'|'agency' }) {
  const appType = options?.appType || 'normal'; const steps: Array<{step:string;ok:boolean;error?:string}> = [];
  const reg = await registerProviderForLocation(locationId, appType); steps.push({ step: 'register', ok: !!reg.ok, error: (reg as any).error });
  const connect = await connectProviderConfig(locationId, 'live', appType); steps.push({ step: 'connect', ok: !!connect.ok, error: (connect as any).error });
  const caps = await updateProviderCapabilities(locationId, appType); steps.push({ step: 'capabilities', ok: !!caps.ok, error: (caps as any).error });
  return { ok: steps.every((step) => step.ok), appType, steps };
}
export function getMarketplaceToken() { return ''; }
