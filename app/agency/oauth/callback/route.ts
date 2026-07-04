import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { applySessionCookie } from '@/lib/session';
import { getAppUrlWithSearch } from '@/lib/app-url';
import { ensureCustomProviderProvisioned } from '@/lib/ghl-provider';

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const locationIdFromQuery = searchParams.get('locationId') || searchParams.get('location_id');
  const companyIdFromQuery = searchParams.get('companyId') || searchParams.get('company_id');

  // If a stale sub-account session exists, drop it before completing agency auth.
  const clearExistingSession = (response: NextResponse) => {
    response.cookies.delete('pf_session');
    return response;
  };

  if (error || !code) {
    return clearExistingSession(NextResponse.redirect(getAppUrlWithSearch(`/agency/install?error=${error || 'access_denied'}`, request)));
  }

  try {
    const clientId = process.env.AGENCY_GHL_CLIENT_ID;
    const clientSecret = process.env.AGENCY_GHL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Missing agency OAuth credentials');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const redirectUri = process.env.AGENCY_OAUTH_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/agency/oauth/callback`;

    const tokenRes = await withTimeout(fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      signal: controller.signal,
    }), 7000, 'Agency token exchange');

    clearTimeout(timeout);

    const raw = await tokenRes.text();
    let tokens: any;
    try {
      tokens = JSON.parse(raw);
    } catch {
      throw new Error(`Agency token exchange returned non-JSON response: ${raw.slice(0, 300)}`);
    }

    if (!tokenRes.ok) throw new Error(`Agency token exchange failed: ${tokenRes.status} ${raw.slice(0, 300)}`);

    const accessToken = pickString(tokens.access_token, tokens.accessToken, tokens.data?.access_token, tokens.data?.accessToken);
    const refreshToken = pickString(tokens.refresh_token, tokens.refreshToken, tokens.data?.refresh_token, tokens.data?.refreshToken);
    const companyId = pickString(tokens.companyId, tokens.company_id, tokens.data?.companyId, tokens.data?.company_id, companyIdFromQuery);
    let locationId = pickString(
      tokens.locationId,
      tokens.location_id,
      tokens.data?.locationId,
      tokens.data?.location_id,
      locationIdFromQuery
    ) || companyId;
    const expiresIn = Number(tokens.expires_in ?? tokens.expiresIn ?? tokens.data?.expires_in ?? 3600);

    if (!accessToken || !refreshToken || !locationId) {
      throw new Error('Agency OAuth missing required fields');
    }

    await withTimeout(query(
      `INSERT INTO installations (location_id, company_id, access_token, refresh_token, expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE company_id = VALUES(company_id), access_token = VALUES(access_token), refresh_token = VALUES(refresh_token), expires_at = VALUES(expires_at)`,
      [locationId, companyId, accessToken, refreshToken, new Date(Date.now() + expiresIn * 1000)]
    ), 3000, 'Agency installation save');

try {
      await ensureCustomProviderProvisioned(locationId, { appType: 'agency' });
    } catch (provErr) {
      console.warn('[Agency OAuth] provider registration failed (continuing):', provErr);
    }

    return applySessionCookie(clearExistingSession(NextResponse.redirect(getAppUrlWithSearch('/agency?installed=1', request))), locationId, 'agency');
  } catch (err) {
    console.error('Agency OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'server_error';
    return clearExistingSession(NextResponse.redirect(getAppUrlWithSearch(`/agency/install?error=${encodeURIComponent(message)}`, request)));
  }
}
