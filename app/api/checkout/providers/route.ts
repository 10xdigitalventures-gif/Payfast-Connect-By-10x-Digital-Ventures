import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isolateProviderAvailability, normalizeGatewayApp } from '@/lib/gateway-apps';

// Public endpoint used by checkout surfaces to learn provider availability.
// The app parameter enforces provider isolation for the three standalone apps.
export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId') || '';
  const gatewayApp = normalizeGatewayApp(request.nextUrl.searchParams.get('app'));
  if (!locationId) {
    return NextResponse.json({ payfast: false, whop: false, swich: false }, { status: 400 });
  }

  const rows = await query<any[]>(
    `SELECT merchant_id, merchant_key,
            whop_enabled, whop_api_key, whop_company_id,
            route_oneoff, route_subscription
       FROM installations WHERE location_id = ? LIMIT 1`,
    [locationId]
  );

  if (!rows.length) {
    return NextResponse.json({ payfast: false, whop: false, swich: false });
  }

  const r = rows[0];
  const payfast = !!(r.merchant_id && r.merchant_key);
  const whop = !!(r.whop_enabled && r.whop_api_key && r.whop_company_id);
  const isolated = isolateProviderAvailability(gatewayApp, { payfast, whop });
  if (isolated) {
    return NextResponse.json(isolated, { headers: { 'Cache-Control': 'no-store' } });
  }

  const routeOneoff = r.route_oneoff === 'whop' ? 'whop' : 'payfast';
  const routeSubscription = r.route_subscription === 'payfast' ? 'payfast' : 'whop';
  return NextResponse.json(
    { payfast, whop, swich: false, routing: { oneoff: routeOneoff, subscription: routeSubscription } },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
