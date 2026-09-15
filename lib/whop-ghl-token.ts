import { query } from './db';

const TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';

export function getWhopOAuthConfig() {
  return {
    clientId: String(process.env.WHOP_GHL_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.WHOP_GHL_CLIENT_SECRET || '').trim(),
    redirectUri: `${String(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')}/oauth/whop/callback`,
  };
}

export async function getValidWhopGhlToken(locationId: string): Promise<string | null> {
  const rows = await query<any[]>('SELECT access_token,refresh_token,expires_at FROM whop_ghl_installations WHERE location_id=? LIMIT 1', [locationId]);
  const installation = rows[0];
  if (!installation?.access_token || !installation?.refresh_token) return null;
  const expiresAt = installation.expires_at ? new Date(installation.expires_at).getTime() : 0;
  if (Date.now() < expiresAt - 5 * 60 * 1000) return String(installation.access_token);
  const config = getWhopOAuthConfig();
  if (!config.clientId || !config.clientSecret) return null;
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
        grant_type: 'refresh_token', refresh_token: String(installation.refresh_token) }),
    });
    if (!response.ok) return null;
    const refreshed: any = await response.json();
    if (!refreshed?.access_token || !refreshed?.refresh_token) return null;
    const expiry = new Date(Date.now() + Math.max(60, Number(refreshed.expires_in || 3600)) * 1000);
    await query(`UPDATE whop_ghl_installations SET access_token=?,refresh_token=?,expires_at=?,updated_at=NOW() WHERE location_id=?`,
      [refreshed.access_token, refreshed.refresh_token, expiry, locationId]);
    return String(refreshed.access_token);
  } catch (error) {
    console.error('[Whop GHL OAuth] refresh failed', error);
    return null;
  }
}
