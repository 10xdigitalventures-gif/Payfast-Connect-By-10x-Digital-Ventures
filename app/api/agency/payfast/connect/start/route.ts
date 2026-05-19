import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';
import { generateToken } from '@/lib/tokens';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId = url.searchParams.get('companyId') || '';

  const session = await getSession();
  if (!session || session.installMode !== 'agency') {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_error=unauthorized`);
  }

  // If a companyId was provided, verify the requesting agency installation
  // is associated with that company (ownership check). If not, reject.
  if (companyId) {
    try {
      const rows = await query<any[]>('SELECT company_id FROM installations WHERE location_id = ? LIMIT 1', [session.locationId]);
      const instCompany = rows[0]?.company_id;
      if (instCompany && String(instCompany) !== String(companyId)) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_error=not_owner`);
      }
    } catch (err) {
      // DB errors should not block flow silently; redirect with error
      const msg = encodeURIComponent(err instanceof Error ? err.message : 'db_error');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/agency/settings?payfast_error=${msg}`);
    }
  }

  const state = generateToken(12);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/agency/payfast/connect/callback`;

  const params = new URLSearchParams({
    client_id: process.env.PAYFAST_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'payments',
    state: JSON.stringify({ state, companyId }),
  });

  const authorizeUrl = `https://api.payfast.co.za/oauth/authorize?${params.toString()}`;

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set('pf_agency_state', state, { httpOnly: true, sameSite: 'lax', path: '/api/agency/payfast/connect/callback', maxAge: 300 });
  return res;
}
