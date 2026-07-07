import { query } from './db';

const GHL_BASE = 'https://services.leadconnectorhq.com';
// SaaS Configurator public APIs are versioned under 2021-04-15.
const SAAS_VERSION = '2021-04-15';

async function refreshToken(refreshToken: string, useAgency = true) {
  if (!refreshToken) return null;
  try {
    const clientId = useAgency
      ? process.env.AGENCY_GHL_CLIENT_ID || process.env.GHL_CLIENT_ID
      : process.env.GHL_CLIENT_ID;
    const clientSecret = useAgency
      ? process.env.AGENCY_GHL_CLIENT_SECRET || process.env.GHL_CLIENT_SECRET
      : process.env.GHL_CLIENT_SECRET;
    const res = await fetch(`${GHL_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch (err) {
    return null;
  }
}

export async function getAgencyContext(locationId: string) {
  if (!locationId) return null;
  const rows = await query<any[]>('SELECT * FROM installations WHERE location_id = ? LIMIT 1', [locationId]);
  if (!rows.length) return null;
  const inst = rows[0];

  // ensure access token is valid; refresh if expired or about to expire (5 min)
  const expiresAt = inst.expires_at ? new Date(inst.expires_at).getTime() : 0;
  const needsRefresh = !inst.access_token || Date.now() >= (expiresAt - 300000);
  if (needsRefresh && inst.refresh_token) {
    const refreshed = await refreshToken(inst.refresh_token, true);
    if (refreshed?.access_token) {
      const newAccess = refreshed.access_token;
      const newRefresh = refreshed.refresh_token || inst.refresh_token;
      const newExpires = new Date(Date.now() + 1000 * (refreshed.expires_in || 3600)).toISOString();
      await query('UPDATE installations SET access_token = ?, refresh_token = ?, expires_at = ? WHERE location_id = ?', [newAccess, newRefresh, newExpires, locationId]);
      inst.access_token = newAccess;
      inst.refresh_token = newRefresh;
      inst.expires_at = newExpires;
    }
  }

  return { locationId, companyId: inst.company_id, accessToken: inst.access_token };
}

// Authenticated call to the GHL SaaS Configurator public API.
// Requires an agency OAuth access token (Agency Pro / SaaS Pro plan).
async function saasFetch(path: string, accessToken: string, opts: { method?: string; body?: any } = {}) {
  if (!accessToken) throw new Error('Missing agency access token');
  const res = await fetch(`${GHL_BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Version: SAAS_VERSION,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.message || data?.error || text || `SaaS request failed ${res.status}`);
  return data;
}

// GET all agency SaaS plans for a company
export async function getAgencyPlans(companyId: string, accessToken: string) {
  if (!companyId) return [];
  return saasFetch(`/saas-api/public-api/agency-plans/${companyId}`, accessToken);
}

// GET SaaS subscription details for a sub-account
export async function getLocationSubscriptionDetails(locationId: string, accessToken: string) {
  return saasFetch(`/saas-api/public-api/location-subscription/${locationId}`, accessToken);
}

// POST enable SaaS for a single sub-account (Agency Pro plan)
export async function enableSaasLocation(locationId: string, accessToken: string, body: any = {}) {
  return saasFetch(`/saas/enable-saas/${locationId}`, accessToken, { method: 'POST', body });
}

// POST bulk enable SaaS for multiple sub-accounts under a company
export async function bulkEnableSaas(companyId: string, accessToken: string, body: any = {}) {
  return saasFetch(`/saas-api/public-api/bulk-enable-saas/${companyId}`, accessToken, { method: 'POST', body });
}

// POST bulk disable SaaS for multiple sub-accounts under a company
export async function bulkDisableSaas(companyId: string, accessToken: string, body: any = {}) {
  return saasFetch(`/saas-api/public-api/bulk-disable-saas/${companyId}`, accessToken, { method: 'POST', body });
}

// POST pause SaaS for a sub-account
export async function pauseSaasLocation(locationId: string, accessToken: string, body: any = {}) {
  return saasFetch(`/saas/pause-saas/${locationId}`, accessToken, { method: 'POST', body });
}

// POST bulk update rebilling for a company
export async function updateRebilling(companyId: string, accessToken: string, body: any = {}) {
  return saasFetch(`/saas-api/public-api/update-rebilling/${companyId}`, accessToken, { method: 'POST', body });
}

// PUT update SaaS subscription for a sub-account
export async function updateSaasSubscription(locationId: string, accessToken: string, body: any = {}) {
  return saasFetch(`/saas-api/public-api/update-saas-subscription/${locationId}`, accessToken, { method: 'PUT', body });
}
