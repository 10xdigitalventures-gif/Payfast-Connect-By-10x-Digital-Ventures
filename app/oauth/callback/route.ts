import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAppUrlWithSearch } from '@/lib/app-url';
import { startTrial } from '@/lib/billing';
import { ensureCustomProviderProvisioned } from '@/lib/ghl-provider';

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

async function resolveLocationIdFallback() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rows = await query<any[]>(
      `SELECT location_id
       FROM installations
       WHERE (access_token = '' OR access_token IS NULL)
         AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    );
    if (rows[0]?.location_id) return rows[0].location_id as string;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const locationIdFromQuery = searchParams.get('locationId') || searchParams.get('location_id');
  const companyIdFromQuery = searchParams.get('companyId') || searchParams.get('company_id');

  if (error || !code) {
    return NextResponse.redirect(
      getAppUrlWithSearch(`/install?error=${error || 'access_denied'}`, request)
    );
  }

  try {
    // Step 1: Exchange code for tokens
    const tokenRes = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GHL_CLIENT_ID!,
        client_secret: process.env.GHL_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/oauth/callback`,
      }),
    });

    const rawText = await tokenRes.text();
    let tokens: any;
    try {
      tokens = JSON.parse(rawText);
    } catch {
      throw new Error(`Token exchange returned non-JSON: ${rawText.slice(0, 300)}`);
    }
    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status} ${rawText.slice(0, 300)}`);
    }

    const accessToken = pickString(
      tokens.access_token, tokens.accessToken,
      tokens.data?.access_token, tokens.data?.accessToken
    );
    const refreshToken = pickString(
      tokens.refresh_token, tokens.refreshToken,
      tokens.data?.refresh_token, tokens.data?.refreshToken
    );
    let locationId = pickString(
      tokens.locationId, tokens.location_id,
      tokens.data?.locationId, tokens.data?.location_id,
      tokens.user?.locationId, tokens.user?.location_id,
      locationIdFromQuery
    );
    const companyId = pickString(
      tokens.companyId, tokens.company_id,
      tokens.data?.companyId, tokens.data?.company_id,
      tokens.user?.companyId, tokens.user?.company_id,
      companyIdFromQuery
    );
    const expiresIn = Number(
      tokens.expires_in ?? tokens.expiresIn ??
      tokens.data?.expires_in ?? tokens.data?.expiresIn ?? 3600
    );

    if (!locationId) locationId = await resolveLocationIdFallback();

    if (!accessToken || !refreshToken || !locationId) {
      throw new Error(
        `Missing OAuth fields. access_token=${!!accessToken} ` +
        `refresh_token=${!!refreshToken} locationId=${locationId || 'missing'}`
      );
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Step 2: Upsert installation in DB (handles reinstalls)
    await query(
      `INSERT INTO installations
         (location_id, company_id, access_token, refresh_token, expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         company_id    = VALUES(company_id),
         access_token  = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         expires_at    = VALUES(expires_at)`,
      [locationId, companyId, accessToken, refreshToken, expiresAt]
    );

    // Step 3: Start trial (idempotent)
    try {
      await startTrial(locationId);
    } catch (trialErr) {
      console.warn('[OAuth] startTrial failed (continuing):', trialErr);
    }

    // Step 4: Register provider with GHL (idempotent, no credentials yet)
    try {
      await ensureCustomProviderProvisioned(locationId, { appType: 'normal' });
    } catch (provErr) {
      console.warn('[OAuth] provider registration failed (continuing):', provErr);
    }

    // Step 5: Show simple success screen — no dashboard, no auto-redirect.
    // GHL itself loads our Custom Page iframe (/payfast-config) next.
    return NextResponse.redirect(
      getAppUrlWithSearch(`/installed?locationId=${encodeURIComponent(locationId)}`, request)
    );
  } catch (err) {
    console.error('[OAuth Callback] error:', err);
    return NextResponse.redirect(
      getAppUrlWithSearch('/install?error=server_error', request)
    );
  }
}
