import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAgencySettings } from '@/lib/billing';
import { normalizeSwichAmount, verifySwichCallback } from '@/lib/swich';

function value(payload: Record<string, string>, ...keys: string[]) { for (const key of keys) if (payload[key]) return payload[key]; return ''; }

async function handle(request: NextRequest, payload: Record<string, string>) {
  const locationId = request.nextUrl.searchParams.get('location_id') || value(payload, 'location_id');
  const invoiceToken = request.nextUrl.searchParams.get('invoice_token') || value(payload, 'invoice_token', 'CustomerTransactionId', 'customerTransactionId');
  if (!locationId || !invoiceToken) return new NextResponse('Missing billing context', { status: 400 });
  const settings = await getAgencySettings();
  const environment = settings?.environment === 'sandbox' ? 'sandbox' : 'live';
  const secretKey = environment === 'sandbox' ? settings?.swich_sandbox_secret_key : settings?.swich_live_secret_key;
  if (!secretKey || !verifySwichCallback(payload, secretKey)) return new NextResponse('Invalid Swich checksum', { status: 400 });

  const invoices = await query<any[]>('SELECT * FROM billing_invoices WHERE token=? AND location_id=? LIMIT 1', [invoiceToken, locationId]);
  if (!invoices.length) return new NextResponse('Billing invoice not found', { status: 404 });
  const invoice = invoices[0];
  if (normalizeSwichAmount(value(payload, 'Amount', 'amount')) !== normalizeSwichAmount(invoice.amount)) return new NextResponse('Amount mismatch', { status: 400 });
  const status = value(payload, 'Status', 'status').toUpperCase();
  const success = ['SUCCESS', 'PAID', 'COMPLETED', 'APPROVED'].includes(status);
  const transactionId = value(payload, 'TransactionId', 'transactionId', 'CustomerTransactionId', 'customerTransactionId');
  await query('UPDATE billing_invoices SET status=?, payment_id=?, provider=\'swich\', updated_at=NOW() WHERE id=?', [success ? 'paid' : 'failed', transactionId || null, invoice.id]);
  if (success && invoice.plan_id) {
    await query(`INSERT INTO location_subscriptions (location_id, plan_id, provider, status, current_period_start, current_period_end, amount)
      VALUES (?, ?, 'swich', 'active', NOW(), ?, ?) ON DUPLICATE KEY UPDATE plan_id=VALUES(plan_id), provider='swich', status='active',
      current_period_start=VALUES(current_period_start), current_period_end=VALUES(current_period_end), amount=VALUES(amount), cancel_at=NULL`,
      [locationId, invoice.plan_id, invoice.period_end, invoice.amount]);
  }
  if (request.nextUrl.searchParams.get('redirect') === 'Y') {
    return NextResponse.redirect(new URL(success ? `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=1&provider=swich` : `${process.env.NEXT_PUBLIC_APP_URL}/billing/suspended?failed=1&provider=swich`));
  }
  return new NextResponse('OK', { status: 200 });
}

export async function GET(request: NextRequest) { return handle(request, Object.fromEntries(request.nextUrl.searchParams.entries())); }
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await request.json() : Object.fromEntries(new URLSearchParams(await request.text()).entries());
  return handle(request, payload);
}
