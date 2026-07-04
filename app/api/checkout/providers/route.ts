import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Public endpoint used by the checkout iframe to learn which payment providers
// are enabled for a location. Returns ONLY booleans — never secrets.
export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId') || '';
  if (!locationId) {
    return NextResponse.json({ payfast: false, whop: false }, { status: 400 });
  }

  const rows = await query<any[]>(
    `SELECT merchant_id, merchant_key,
            whop_enabled, whop_api_key, whop_company_id
       FROM installations WHERE location_id = ? LIMIT 1`,
    [locationId]
  );

  if (!rows.length) {
    return NextResponse.json({ payfast: false, whop: false });
  }

  const r = rows[0];
  const payfast = !!(r.merchant_id && r.merchant_key);
  const whop = !!(r.whop_enabled && r.whop_api_key && r.whop_company_id);

  return NextResponse.json(
    { payfast, whop },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
