import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Payment status polling endpoint.
 *
 * Called every 2 seconds by the checkout iframe while the user completes
 * payment in the PayFast popup. Returns the current state of the payment
 * keyed by the payToken (which is stored as custom_str1 in the payments
 * table when we initiate the charge).
 *
 * Response shape:
 *   { status: 'pending' | 'complete' | 'failed' | 'cancelled',
 *     chargeId?: string, message?: string }
 *
 * No authentication required — the payToken itself is a 16-char random
 * secret that only the user who initiated the payment can know.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const rows = await query<any[]>(
    `SELECT id, status, pf_payment_id, raw_itn, amount, updated_at
     FROM payments
     WHERE custom_str1 = ?
     ORDER BY id DESC
     LIMIT 1`,
    [token]
  );

  if (!rows.length) {
    return NextResponse.json({ status: 'pending', message: 'Payment not found yet' });
  }

  const p = rows[0];

  if (p.status === 'complete') {
    return NextResponse.json({
      status:   'complete',
      chargeId: p.pf_payment_id || token,
      amount:   p.amount,
    });
  }

  if (p.status === 'failed') {
    let message = 'Payment failed';
    try {
      const itn = p.raw_itn ? JSON.parse(p.raw_itn) : null;
      if (itn?.err_msg) message = String(itn.err_msg);
      else if (itn?.ERR_MSG) message = String(itn.ERR_MSG);
    } catch { /* keep default message */ }
    return NextResponse.json({ status: 'failed', message });
  }

  if (p.status === 'cancelled') {
    return NextResponse.json({ status: 'cancelled' });
  }

  return NextResponse.json({ status: 'pending' });
}