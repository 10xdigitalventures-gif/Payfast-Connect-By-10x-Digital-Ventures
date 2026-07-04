import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { applySessionCookie, InstallMode } from '@/lib/session';
import { getAppUrlWithSearch } from '@/lib/app-url';

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode') === 'agency' ? 'agency' : 'subaccount';
  const locationId = request.nextUrl.searchParams.get('locationId') || request.nextUrl.searchParams.get('location_id');
  const companyId = request.nextUrl.searchParams.get('companyId') || request.nextUrl.searchParams.get('company_id');

  if (!locationId && !companyId) {
    return NextResponse.redirect(getAppUrlWithSearch(mode === 'agency' ? '/agency/install' : '/install', request));
  }

  const rows = await query<Array<{ location_id: string; company_id: string | null }>>(
    `SELECT location_id, company_id
     FROM installations
     WHERE (? IS NOT NULL AND location_id = ?)
        OR (? IS NOT NULL AND company_id = ?)
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [locationId, locationId, companyId, companyId]
  );

  if (!rows.length) {
    return NextResponse.redirect(getAppUrlWithSearch(mode === 'agency' ? '/agency/install' : '/install', request));
  }

  const install = rows[0];
  const installMode: InstallMode = mode;
  const destination = installMode === 'agency' ? '/agency?restored=1' : '/dashboard?restored=1';

  return applySessionCookie(NextResponse.redirect(getAppUrlWithSearch(destination, request)), install.location_id, installMode);
}
