import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const apiKey = String(body.apiKey || body.api_key || request.headers.get('x-api-key') || '').trim();
  let locationId = String(body.locationId || request.nextUrl.searchParams.get('locationId') || '').trim();
  if (!locationId && apiKey) {
    const owners = await query<any[]>('SELECT location_id FROM payfast_ghl_installations WHERE provider_api_key=? LIMIT 1', [apiKey]);
    locationId = owners[0]?.location_id || '';
  }
  if (!locationId) return NextResponse.json({ success: false, error: 'Unable to resolve PayFast location' }, { status: 400 });
  const installations = await query<any[]>('SELECT provider_api_key FROM payfast_ghl_installations WHERE location_id=? LIMIT 1', [locationId]);
  if (!safeEqual(String(installations[0]?.provider_api_key || ''), apiKey)) {
    return NextResponse.json({ success: false, error: 'Unauthorized PayFast verification' }, { status: 401 });
  }

  if (body.type === 'verify') {
    const chargeId = String(body.chargeId || '').trim();
    const transactionId = String(body.transactionId || body.ghlTransactionId || '').trim();
    const rows = await query<any[]>(`SELECT * FROM payments
      WHERE location_id=? AND provider='payfast' AND (pf_payment_id=? OR pf_token=? OR custom_str3=? OR custom_str3=?)
      ORDER BY id DESC LIMIT 1`, [locationId, chargeId, chargeId, transactionId, chargeId]);
    if (!rows.length) return NextResponse.json({ success: false, message: 'Payment not found' });
    const payment = rows[0];
    const succeeded = payment.status === 'complete';
    const failed = ['failed', 'cancelled', 'refunded'].includes(payment.status);
    const resolved = payment.pf_payment_id || payment.pf_token || chargeId;
    return NextResponse.json({
      success: succeeded,
      failed,
      message: succeeded ? 'Payment verified' : failed ? 'Payment failed' : 'Payment pending',
      chargeSnapshot: {
        id: resolved,
        chargeId: resolved,
        status: succeeded ? 'succeeded' : failed ? 'failed' : 'pending',
        amount: Number(payment.amount || 0),
        chargedAt: Math.floor(new Date(payment.updated_at || payment.created_at || Date.now()).getTime() / 1000),
      },
    });
  }

  if (body.type === 'refund') {
    return NextResponse.json({ success: false, failed: true,
      message: 'PayFast refunds must be completed through the merchant refund workflow.' }, { status: 501 });
  }
  return NextResponse.json({ error: 'Unsupported PayFast query type' }, { status: 400 });
}

export async function GET() {
  return NextResponse.json({ status: 'ok', provider: 'PayFast Connect by 10x Digital Ventures', app: 'payfast' });
}
