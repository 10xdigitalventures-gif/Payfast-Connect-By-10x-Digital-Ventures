import { query } from './db';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const BACKEND_BASE = 'https://backend.leadconnectorhq.com';

async function refreshToken(refreshToken: string, useAgency = false) {
  if (!refreshToken) return null;
  try {
    const clientId = useAgency ? process.env.AGENCY_GHL_CLIENT_ID || process.env.GHL_CLIENT_ID : process.env.GHL_CLIENT_ID;
    const clientSecret = useAgency ? process.env.AGENCY_GHL_CLIENT_SECRET || process.env.GHL_CLIENT_SECRET : process.env.GHL_CLIENT_SECRET;
    const res = await fetch(`${GHL_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId || '', client_secret: clientSecret || '', grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data;
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

async function agencyFetch(path: string, opts: { method?: string; body?: any; base?: 'ghl' | 'backend' } = {}) {
  const base = opts.base === 'backend' ? BACKEND_BASE : GHL_BASE;
  const url = `${base}${path}`;
  const res = await fetch(url, { method: opts.method || 'GET', headers: { Version: '2021-07-28', 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.message || data?.error || text || `Request failed ${res.status}`);
  return data;
}

export async function getAgencyPlans(...args: any[]) {
  // getAgencyPlans(companyId, accessToken?) - if accessToken provided, call directly; otherwise expect caller to proxy
  const [companyId, accessToken] = args;
  if (!companyId) return [];
  // prefer calling public agency endpoint via backend which requires agency token; leaving simple fetch
  return agencyFetch(`/saas/agency-plans/${companyId}`);
}

export async function enableSaasLocation(...args: any[]) { const [locationId, body] = args; return agencyFetch(`/saas/enable-saas/${locationId}`, { method: 'POST', body }); }
export async function getLocationSubscriptionDetails(...args: any[]) { const [locationId] = args; return agencyFetch(`/saas/get-saas-subscription/${locationId}`); }
export async function pauseSaasLocation(...args: any[]) { const [locationId, body] = args; return agencyFetch(`/saas/pause-saas/${locationId}`, { method: 'POST', body }); }
export async function updateRebilling(...args: any[]) { const [locationId, body] = args; return agencyFetch(`/saas/update-rebilling/${locationId}`, { method: 'POST', body }); }
export async function updateSaasSubscription(...args: any[]) { const [locationId, body] = args; return agencyFetch(`/saas/update-saas-subscription/${locationId}`, { method: 'PUT', body }); }
