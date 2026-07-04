import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';

// Handles PayFast OAuth callback for agency installs.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state') || '';

  const session = await getSession();
  if (!session || session.installMode !== 'agency') {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_error=unauthorized`);
  }

  // Validate state cookie against the returned state
  const cookieState = (request as any).cookies?.get?.('pf_agency_state')?.value;
  let parsedState: { state?: string; companyId?: string } = {};
  try {
    parsedState = JSON.parse(stateParam || '{}');
  } catch (e) {
    // ignore
  }

  if (!cookieState || !parsedState.state || cookieState !== parsedState.state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_error=invalid_state`);
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_error=no_code`);
  }

  // Exchange code for tokens
  const tokenUrl = 'https://api.payfast.co.za/oauth/token';
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.PAYFAST_CLIENT_ID || '',
      client_secret: process.env.PAYFAST_CLIENT_SECRET || '',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/agency/payfast/connect/callback`,
    });

    const tokenRes = await fetch(tokenUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text().catch(() => 'token_exchange_failed');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_error=${encodeURIComponent(txt)}`);
    }

    const data = await tokenRes.json().catch(() => ({}));
    const access_token = (data as any).access_token;
    const refresh_token = (data as any).refresh_token || null;
    const expires_in = Number((data as any).expires_in) || 0;

    if (!access_token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_error=no_access_token`);
    }

    const expires_at = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

    const companyId = parsedState.companyId || null;

    // Persist tokens to installations table, scoped to the agency installation location
    const sql = `INSERT INTO installations (location_id, company_id, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), refresh_token = VALUES(refresh_token), expires_at = VALUES(expires_at)`;
    try {
      await query(sql, [session.locationId, companyId, access_token, refresh_token, expires_at]);
    } catch (err) {
      const msg = encodeURIComponent(err instanceof Error ? err.message : 'db_error');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_error=${msg}`);
    }

    // Clear state cookie and redirect back to settings with success flag
    const res = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_connected=1`);
    try {
      // Delete state cookie (no options to satisfy Next.js types)
      res.cookies.delete('pf_agency_state');
    } catch (e) {
      // ignore
    }
    return res;
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'unknown_error');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_error=${msg}`);
  }
}
