import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAppUrlWithSearch } from '@/lib/app-url';

/**
 * Existing installations are not authentication credentials.
 * The legacy launch URL may only route an already authenticated user.
 * Signed HighLevel SSO/launch verification must be implemented separately
 * before supporting passwordless Marketplace launches.
 */
export async function GET(request: NextRequest) {
  const requestedMode = request.nextUrl.searchParams.get('mode') === 'agency' ? 'agency' : 'subaccount';
  const locationId = request.nextUrl.searchParams.get('locationId') ||
    request.nextUrl.searchParams.get('location_id');
  const companyId = request.nextUrl.searchParams.get('companyId') ||
    request.nextUrl.searchParams.get('company_id');

  const session = await getSession();
  if (!session) {
    const loginPath = requestedMode === 'agency' ? '/agency/login' : '/login';
    return NextResponse.redirect(getAppUrlWithSearch(loginPath, request));
  }

  const isAgency = session.role === 'agency' && session.installMode === 'agency';
  const isSubaccount = session.role === 'user' && session.installMode === 'subaccount';
  if ((requestedMode === 'agency' && !isAgency) ||
      (requestedMode === 'subaccount' && !isSubaccount)) {
    return NextResponse.json({ error: 'Unauthorized launch mode' }, { status: 403 });
  }

  // A companyId alone is insufficient proof of access to any location.
  // Agency delegation requires a separate verified membership lookup.
  if (companyId && !locationId) {
    return NextResponse.json({ error: 'Location-specific authentication required' }, { status: 403 });
  }
  if (locationId && locationId !== session.locationId) {
    return NextResponse.json({ error: 'Unauthorized location' }, { status: 403 });
  }

  const destination = requestedMode === 'agency' ? '/agency' : '/dashboard';
  return NextResponse.redirect(getAppUrlWithSearch(destination, request));
}
