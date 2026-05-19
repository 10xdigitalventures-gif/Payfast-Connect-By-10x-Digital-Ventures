import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAgencySettings } from '@/lib/billing';
import { extractCapturedInstrument, verifySignature } from '@/lib/payfast';
import { savePaymentInstrument } from '@/lib/payment-instruments';

function value(record: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const v = record[key];
    if (v != null && v !== '') return v;
  }
  return '';
}

async function handleCallback(request: NextRequest, payload: Record<string, string>) {
  const settings = await getAgencySettings();
  const locationId = value(payload, 'location_id') || request.nextUrl.searchParams.get('location_id') || '';
  const invoiceToken = value(payload, 'invoice_token') || request.nextUrl.searchParams.get('invoice_token') || '';
  const errCode = value(payload, 'err_code', 'ERR_CODE');
  const transactionId = value(payload, 'transaction_id', 'TRANSACTION_ID');
  const redirectMode = value(payload, 'redirect') || request.nextUrl.searchParams.get('redirect') || '';
  const saveCardOnly = value(payload, 'save_card') || request.nextUrl.searchParams.get('save_card') || '';

  if (!locationId || !invoiceToken) return new NextResponse('Missing billing context', { status: 400 });
  if (!settings?.merchant_id || !settings?.merchant_key) return new NextResponse('Agency settings missing', { status: 500 });

  if (!verifySignature(payload, settings.merchant_key, settings.merchant_id)) {
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const invoices = await query<any[]>('SELECT * FROM billing_invoices WHERE token = ? AND location_id = ? LIMIT 1', [invoiceToken, locationId]);
  if (!invoices.length) return new NextResponse('Billing invoice not found', { status: 404 });
  const invoice = invoices[0];
  const success = errCode === '000';
  const capturedInstrument = extractCapturedInstrument(payload);

  await query(
    `UPDATE billing_invoices SET status = ?, payment_id = ?, updated_at = NOW() WHERE id = ?`,
    [success ? 'paid' : 'failed', transactionId || null, invoice.id]
  );

  if (success && !saveCardOnly && invoice.plan_id) {
    await query(
      `INSERT INTO location_subscriptions (location_id, plan_id, status, current_period_start, current_period_end, amount)
       VALUES (?, ?, 'active', NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE
         plan_id = VALUES(plan_id),
         status = 'active',
         current_period_start = VALUES(current_period_start),
         current_period_end = VALUES(current_period_end),
          amount = VALUES(amount),
          cancel_at = NULL`,
      [locationId, invoice.plan_id, invoice.period_end, invoice.amount]
    );

  }

  if (success && capturedInstrument.instrumentToken) {
    await savePaymentInstrument(locationId, {
      instrumentToken: capturedInstrument.instrumentToken,
      instrumentAlias: capturedInstrument.alias,
      cardLastFour: capturedInstrument.cardLastFour,
      expiryDate: capturedInstrument.expiryDate,
      isDefault: true,
    });

    await query(
      `UPDATE location_subscriptions
       SET recurring_token = ?
       WHERE location_id = ?`,
      [capturedInstrument.instrumentToken, locationId]
    );
  }

  if (redirectMode === 'Y') {
    const redirectUrl = saveCardOnly
      ? `${process.env.NEXT_PUBLIC_APP_URL}/billing?card_saved=${success ? '1' : '0'}`
      : success
      ? `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=1`
      : `${process.env.NEXT_PUBLIC_APP_URL}/billing/suspended?failed=1`;
    return NextResponse.redirect(new URL(redirectUrl));
  }

  return new NextResponse('OK', { status: 200 });
}

export async function GET(request: NextRequest) {
  return handleCallback(request, Object.fromEntries(request.nextUrl.searchParams.entries()));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const payload = Object.fromEntries(new URLSearchParams(body).entries());
  return handleCallback(request, payload);
}
