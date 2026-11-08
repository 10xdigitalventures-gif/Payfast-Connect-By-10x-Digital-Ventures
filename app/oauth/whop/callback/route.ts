import { checkGatewayOAuthCallback } from '@/lib/gateway-oauth-flow';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAppUrlWithSearch } from '@/lib/app-url';

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export async function GET(request: NextRequest) {
  // Validate and atomically consume any controlled-install state BEFORE the
  // authorization code is exchanged. Native Marketplace links can deliver
  // code-only callbacks; these remain a separately documented fallback.
  try {
    const checked = await checkGatewayOAuthCallback(request, 'whop');
    if (!checked.ok) {
      return NextResponse.redirect(getAppUrlWithSearch('/install?provider=whop&error=invalid_oauth_state', request));
    }
  } catch (stateError) {
    console.error('[whop OAuth] state validation failed', stateError);
    return NextResponse.redirect(getAppUrlWithSearch('/install?provider=whop&error=state_validation_unavailable', request));
  }
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(
      getAppUrlWithSearch(`/install?provider=whop&error=${encodeURIComponent(error || 'access_denied')}`, request),
    );
  }

  const clientId = process.env.WHOP_GHL_CLIENT_ID;
  const clientSecret = process.env.WHOP_GHL_CLIENT_SECRET;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');

  if (!clientId || !clientSecret || !appUrl) {
    console.error('[10x Whop OAuth] Missing WHOP_GHL_CLIENT_ID, WHOP_GHL_CLIENT_SECRET, or NEXT_PUBLIC_APP_URL');
    return NextResponse.redirect(
      getAppUrlWithSearch('/install?provider=whop&error=server_configuration', request),
    );
  }

  try {
    const redirectUri = `${appUrl}/oauth/whop/callback`;
    const tokenRes = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Version: 'v3' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const rawText = await tokenRes.text();
    let tokens: any = null;
    try {
      tokens = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error(`Token exchange returned non-JSON: ${rawText.slice(0, 200)}`);
    }

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status} ${rawText.slice(0, 200)}`);
    }

    const accessToken = pickString(
      tokens?.access_token,
      tokens?.accessToken,
      tokens?.data?.access_token,
      tokens?.data?.accessToken,
    );
    const refreshToken = pickString(
      tokens?.refresh_token,
      tokens?.refreshToken,
      tokens?.data?.refresh_token,
      tokens?.data?.refreshToken,
    );
    // Only the verified OAuth token response may establish the installation location.
    const locationId = pickString(
      tokens?.locationId,
      tokens?.location_id,
      tokens?.data?.locationId,
      tokens?.data?.location_id,
      tokens?.user?.locationId,
      tokens?.user?.location_id,
    );
    const companyId = pickString(
      tokens?.companyId,
      tokens?.company_id,
      tokens?.data?.companyId,
      tokens?.data?.company_id,
      tokens?.user?.companyId,
      tokens?.user?.company_id,
    );
    const expiresIn = Number(
      tokens?.expires_in ?? tokens?.expiresIn ?? tokens?.data?.expires_in ?? tokens?.data?.expiresIn ?? 3600,
    );

    if (!accessToken || !refreshToken || !locationId) {
      throw new Error('OAuth response is missing access token, refresh token, or location ID');
    }

    const expiresAt = new Date(Date.now() + Math.max(60, expiresIn) * 1000);

    await query(
      `INSERT INTO whop_ghl_installations
        (location_id, company_id, access_token, refresh_token, expires_at, installed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         company_id = VALUES(company_id),
         access_token = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         expires_at = VALUES(expires_at),
         updated_at = NOW()`,
      [locationId, companyId, accessToken, refreshToken, expiresAt],
    );

    return NextResponse.redirect(
      getAppUrlWithSearch(`/installed?provider=whop&locationId=${encodeURIComponent(locationId)}`, request),
    );
  } catch (err) {
    console.error('[10x Whop OAuth] callback failed', err);
    return NextResponse.redirect(
      getAppUrlWithSearch('/install?provider=whop&error=server_error', request),
    );
  }
}
