import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Polled by the checkout iframe (customer's browser) to learn the REAL
// PayFast outcome after the popup completes. The ITN handler
// (app/api/payfast/itn) is what sets payments.status to 'complete'/'failed'.
//
// basketId (pf_token) is an unguessable random token; we also require
// locationId. We return only minimal status — no sensitive data.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const basketId = sp.get('basketId') || sp.get('basket_id') || '';
  const locationId = sp.get('locationId') || sp.get('location_id') || '';

  if (!basketId || !locationId) {
    return NextResponse.json(
      { status: 'pending', error: 'basketId and locationId required' },
      { status: 400 },
    );
  }

  const rows = await query<any[]>(
    `SELECT status, pf_payment_id
       FROM payments
      WHERE pf_token = ? AND location_id = ?
      ORDER BY id DESC
      LIMIT 1`,
    [basketId, locationId],
  );

  if (!rows.length) {
    // Payment row not found yet (or wrong basket) — treat as still pending.
    return NextResponse.json({ status: 'pending' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const p = rows[0];
  const status =
    p.status === 'complete'
      ? 'paid'
      : p.status === 'failed' || p.status === 'refunded'
        ? 'failed'
        : 'pending';

  return NextResponse.json(
    { status, chargeId: p.pf_payment_id || null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}