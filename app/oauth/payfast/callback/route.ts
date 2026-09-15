import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAppUrlWithSearch } from '@/lib/app-url';
import { getPayfastOAuthConfig } from '@/lib/payfast-ghl-token';
import { provisionPayfastProvider } from '@/lib/payfast-ghl-provider';

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get('error');
  const code = request.nextUrl.searchParams.get('code');
  if (error || !code) {
    return NextResponse.redirect(getAppUrlWithSearch(`/install?provider=payfast&error=${encodeURIComponent(error || 'access_denied')}`, request));
  }

  const config = getPayfastOAuthConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri.startsWith('http')) {
    console.error('[PayFast OAuth] missing PAYFAST_GHL_CLIENT_ID, PAYFAST_GHL_CLIENT_SECRET, or NEXT_PUBLIC_APP_URL');
    return NextResponse.redirect(getAppUrlWithSearch('/install?provider=payfast&error=server_configuration', request));
  }

  try {
    const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }),
    });
    const raw = await tokenResponse.text();
    let tokens: any = null;
    try { tokens = raw ? JSON.parse(raw) : null; } catch { throw new Error(`Token exchange returned non-JSON: ${raw.slice(0, 200)}`); }
    if (!tokenResponse.ok) throw new Error(`Token exchange failed: ${tokenResponse.status} ${raw.slice(0, 200)}`);

    const accessToken = pickString(tokens?.access_token, tokens?.accessToken, tokens?.data?.access_token, tokens?.data?.accessToken);
    const refreshToken = pickString(tokens?.refresh_token, tokens?.refreshToken, tokens?.data?.refresh_token, tokens?.data?.refreshToken);
    const locationId = pickString(
      tokens?.locationId, tokens?.location_id, tokens?.data?.locationId, tokens?.data?.location_id,
      tokens?.user?.locationId, tokens?.user?.location_id,
      request.nextUrl.searchParams.get('locationId'), request.nextUrl.searchParams.get('location_id'),
    );
    const companyId = pickString(
      tokens?.companyId, tokens?.company_id, tokens?.data?.companyId, tokens?.data?.company_id,
      request.nextUrl.searchParams.get('companyId'), request.nextUrl.searchParams.get('company_id'),
    );
    if (!accessToken || !refreshToken || !locationId) throw new Error('OAuth response is missing token or location fields');
    const expiresAt = new Date(Date.now() + Math.max(60, Number(tokens?.expires_in || tokens?.expiresIn || 3600)) * 1000);

    await query(
      `INSERT INTO payfast_ghl_installations
        (location_id, company_id, access_token, refresh_token, expires_at, installed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE company_id=VALUES(company_id), access_token=VALUES(access_token),
         refresh_token=VALUES(refresh_token), expires_at=VALUES(expires_at), updated_at=NOW()`,
      [locationId, companyId, accessToken, refreshToken, expiresAt],
    );

    // Provision only when credentials already exist (for example after migration).
    const credentials = await query<any[]>(
      'SELECT merchant_id, merchant_key, environment FROM payfast_ghl_installations WHERE location_id=? LIMIT 1',
      [locationId],
    );
    if (credentials[0]?.merchant_id && credentials[0]?.merchant_key) {
      await provisionPayfastProvider(locationId, credentials[0].environment === 'live' ? 'live' : 'test');
    }

    return NextResponse.redirect(
      getAppUrlWithSearch(`/apps/payfast/settings?locationId=${encodeURIComponent(locationId)}`, request),
    );
  } catch (callbackError) {
    console.error('[PayFast OAuth] callback failed', callbackError);
    return NextResponse.redirect(getAppUrlWithSearch('/install?provider=payfast&error=server_error', request));
  }
}
