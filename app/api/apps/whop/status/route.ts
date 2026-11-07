import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Browser polling is not an authority to mark payments complete.
 * Only a signed provider webhook changes the underlying payments row.
 * A separate random status token prevents guessing payment results by basket ID.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const basketId = params.get('basketId') || '';
  const locationId = params.get('locationId') || '';
  const statusToken = params.get('payToken') || '';
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(locationId) ||
      !/^[A-Za-z0-9_-]{1,255}$/.test(basketId) ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(statusToken)) {
    return NextResponse.json({ error: 'Invalid payment status request' }, { status: 400 });
  }
  const rows = await query<any[]>(
    `SELECT status, pf_payment_id FROM payments
     WHERE location_id=? AND provider='whop' AND pf_token=? AND custom_str1=?
     ORDER BY id DESC LIMIT 1`,
    [locationId, basketId, statusToken],
  );
  if (!rows.length) return NextResponse.json({ error: 'Payment status not found' }, { status: 404 });
  const payment = rows[0];
  const status = payment.status === 'complete' ? 'paid'
    : ['failed', 'refunded', 'cancelled'].includes(payment.status) ? 'failed' : 'pending';
  return NextResponse.json(
    { status, chargeId: status === 'paid' ? payment.pf_payment_id || basketId : undefined },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
