import { getValidToken } from './ghl';
import { query } from './db';
import crypto from 'crypto';

const GHL_API = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

function appUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

const PROVIDER_NAME = 'Payfast Connect by 10x Digital Ventures';
const PROVIDER_DESCRIPTION = 'CRM-native PayFast payment connector';

async function ghlRequest(
  path: string,
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown
) {
  const res = await fetch(`${GHL_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: VERSION,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = typeof data === 'string' ? data : data?.message || data?.error || `GHL request failed: ${res.status}`;
    const err = new Error(`${res.status} ${msg}`);
    (err as any).status = res.status;
    (err as any).body = data;
    throw err;
  }

  return data;
}

async function ensureProviderKeys(locationId: string) {
  const rows = await query<any[]>(
    `SELECT provider_api_key, provider_publishable_key
     FROM installations WHERE location_id = ? LIMIT 1`,
    [locationId]
  );

  let apiKey = rows[0]?.provider_api_key || null;
  let publishableKey = rows[0]?.provider_publishable_key || null;

  if (!apiKey || !publishableKey) {
    apiKey = apiKey || `sk_${crypto.randomBytes(24).toString('hex')}`;
    publishableKey = publishableKey || `pk_${crypto.randomBytes(16).toString('hex')}`;
    await query(
      `UPDATE installations
       SET provider_api_key = ?, provider_publishable_key = ?
       WHERE location_id = ?`,
      [apiKey, publishableKey, locationId]
    );
  }

  return { apiKey, publishableKey };
}

/**
 * STAGE 1 — Register the provider association for this location.
 * Per official SDK: locationId goes in QUERY STRING, not body.
 */
export async function registerProviderForLocation(
  locationId: string,
  appType: 'normal' | 'agency' = 'normal'
) {
  const token = await getValidToken(locationId);
  if (!token) return { ok: false, reason: 'missing_token' as const };

  // Per the official docs (Create Public Provider Config) + SDK
  // (Models.CreateCustomProvidersDto): locationId is sent both in the body
  // (per docs) and the query string (per SDK) for maximum compatibility.
  const body = {
    name: PROVIDER_NAME,
    description: PROVIDER_DESCRIPTION,
    locationId,
    paymentsUrl: appUrl('/checkout'),
    queryUrl: appUrl('/api/ghl/query'),
    imageUrl: process.env.GHL_PROVIDER_LOGO_URL || appUrl('/logo.png'),
    supportsSubscriptionSchedule: true,
  };

  try {
    const qs = new URLSearchParams({ locationId }).toString();
    const resp = await ghlRequest(
      `/payments/custom-provider/provider?${qs}`,
      token,
      'POST',
      body
    );
    return { ok: true, response: resp };
  } catch (error) {
    console.error('[GHL Provider] registerProviderForLocation failed', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * STAGE 2 — Connect (or update) the provider config for this location.
 * Per official SDK: locationId in query, body has only { live, test }.
 */
export async function connectProviderConfig(
  locationId: string,
  mode: 'live' | 'test' = 'live',
  _appType: 'normal' | 'agency' = 'normal'
) {
  const token = await getValidToken(locationId);
  if (!token) return { ok: false, reason: 'missing_token' as const };

  const { apiKey, publishableKey } = await ensureProviderKeys(locationId);

  // Per Models.ConnectCustomProvidersConfigDto: { live: any, test: any }
  // Provide config for both modes; for the unused mode, send the same keys
  // (GHL stores both independently).
  const configForMode = { apiKey, publishableKey };
  const body = {
    live:  mode === 'live'  ? configForMode : configForMode,
    test:  mode === 'test'  ? configForMode : configForMode,
  };

  try {
    const qs = new URLSearchParams({ locationId }).toString();
    const resp = await ghlRequest(
      `/payments/custom-provider/connect?${qs}`,
      token,
      'POST',
      body
    );
    return { ok: true, response: resp, apiKey, publishableKey };
  } catch (error) {
    console.error('[GHL Provider] connectProviderConfig failed', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Update capabilities for this marketplace app.
 * Per Models.UpdateCustomProviderCapabilitiesDto: only supportsSubscriptionSchedules
 * is required (boolean). locationId / companyId are OPTIONAL body fields.
 */
export async function updateProviderCapabilities(
  locationId: string,
  _appType: 'normal' | 'agency' = 'normal'
) {
  const token = await getValidToken(locationId);
  if (!token) return { ok: false, reason: 'missing_token' as const };

  const body = {
    supportsSubscriptionSchedules: true,
    locationId,
  };

  try {
    const resp = await ghlRequest(
      '/payments/custom-provider/capabilities',
      token,
      'PUT',
      body
    );
    return { ok: true, response: resp };
  } catch (error) {
    console.error('[GHL Provider] updateProviderCapabilities failed', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Disconnect provider config.
 * Per Models.DeleteCustomProvidersConfigDto: { liveMode: boolean }
 */
export async function disconnectCustomProvider(
  locationId: string,
  mode: 'live' | 'test' = 'live',
  _appType: 'normal' | 'agency' = 'normal'
) {
  const token = await getValidToken(locationId);
  if (!token) throw new Error('Missing token for disconnect');

  try {
    const qs = new URLSearchParams({ locationId }).toString();
    await ghlRequest(
      `/payments/custom-provider/disconnect?${qs}`,
      token,
      'POST',
      { liveMode: mode === 'live' }
    );
    return { ok: true };
  } catch (error) {
    console.error('[GHL Provider] disconnect failed', error);
    throw error;
  }
}

/**
 * Convenience wrapper used by OAuth callback.
 */
export async function ensureCustomProviderProvisioned(
  locationId: string,
  options?: { appType?: 'normal' | 'agency' }
) {
  const appType = options?.appType || 'normal';
  const steps: Array<{ step: string; ok: boolean; error?: string }> = [];

  const reg = await registerProviderForLocation(locationId, appType);
  steps.push({ step: 'register', ok: !!reg.ok, error: (reg as any).error });

  // Connect the provider config so HighLevel marks it as CONNECTED and shows
  // the Connect / Manage / Set-as-Default option in Payments -> Integrations.
  // Uses auto-generated sk_/pk_ keys; a single call configures both live+test.
  const connect = await connectProviderConfig(locationId, 'live', appType);
  steps.push({ step: 'connect', ok: !!connect.ok, error: (connect as any).error });

  const caps = await updateProviderCapabilities(locationId, appType);
  steps.push({ step: 'capabilities', ok: !!caps.ok, error: (caps as any).error });

  return { ok: true, appType, steps };
}

// Backward compatibility export (no longer used; kept in case any code imports it)
export function getMarketplaceToken() { return ''; }
