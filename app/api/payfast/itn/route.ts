import { NextRequest, NextResponse } from 'next/server';
import { query, Installation } from '@/lib/db';
import { extractCapturedInstrument, verifySignature, PAYFAST_VALID_IPS } from '@/lib/payfast';
import { handlePaymentSync } from '@/lib/ghl';
import { parsePublicPayMeta } from '@/lib/public-pay';
import { savePaymentInstrument } from '@/lib/payment-instruments';

function getValue(record: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value != null && value !== '') return value;
  }
  return '';
}

async function processAppsCallback(request: NextRequest, payload: Record<string, string>) {
  const locationId = getValue(payload, 'location_id') || request.nextUrl.searchParams.get('location_id') || '';
  const basketId = getValue(payload, 'basket_id', 'BASKET_ID') || request.nextUrl.searchParams.get('basket_id') || '';
  const errCode = getValue(payload, 'err_code', 'ERR_CODE');
  const transactionId = getValue(payload, 'transaction_id', 'TRANSACTION_ID');
  const statusMessage = getValue(payload, 'err_msg', 'ERR_MSG');
  const paymentMethod = getValue(payload, 'PaymentName', 'PAYMENT_NAME');
  const redirectMode = getValue(payload, 'redirect') || request.nextUrl.searchParams.get('redirect') || '';
  const capturedInstrument = extractCapturedInstrument(payload);

  if (!locationId || !basketId) {
    return new NextResponse('Missing callback context', { status: 400 });
  }

  const instRows = await query<Installation[]>('SELECT * FROM installations WHERE location_id = ?', [locationId]);
  if (!instRows.length) return new NextResponse('Installation not found', { status: 404 });
  const inst = instRows[0];

  if (!verifySignature(payload, inst.merchant_key, inst.merchant_id)) {
    console.warn('[APPS Callback] Signature mismatch');
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const paymentRows = await query<any[]>(
    `SELECT * FROM payments WHERE pf_token = ? AND location_id = ? ORDER BY id DESC LIMIT 1`,
    [basketId, locationId]
  );
  if (!paymentRows.length) return new NextResponse('Payment not found', { status: 404 });
  const payment = paymentRows[0];

  let metadata: any = null;
  try {
    metadata = payment.item_description ? JSON.parse(payment.item_description) : null;
  } catch {
    metadata = null;
  }

  const success = errCode === '000';

  await query(
    `UPDATE payments
     SET pf_payment_id = ?, status = ?, raw_itn = ?, updated_at = NOW()
     WHERE id = ?`,
    [transactionId || null, success ? 'complete' : 'failed', JSON.stringify({ ...payload, paymentMethod }), payment.id]
  );

  if (success) {
    if (capturedInstrument.instrumentToken) {
      await savePaymentInstrument(locationId, {
        instrumentToken: capturedInstrument.instrumentToken,
        instrumentAlias: capturedInstrument.alias || paymentMethod || null,
        cardLastFour: capturedInstrument.cardLastFour,
        expiryDate: capturedInstrument.expiryDate,
        isDefault: payment.payment_type === 'subscription',
      });
    }

    if (payment.custom_str3) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ghl/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          ghlTransactionId: payment.custom_str3,
          chargeId: transactionId,
          amount: payment.amount,
          contactId: metadata?.contactId || payment.contact_id || null,
          invoiceId: metadata?.invoiceId || null,
          eventType: payment.payment_type === 'subscription' ? 'subscription.charged' : 'payment.captured',
        }),
      }).catch((e) => console.error('[APPS→CRM Notify]', e));
    } else {
      const tags = (inst.tag_on_payment || 'paid,customer').split(',').map((t) => t.trim()).filter(Boolean);
      const ghlId = await handlePaymentSync({
        locationId,
        email: payment.payer_email,
        firstName: payment.payer_first || '',
        lastName: payment.payer_last || '',
        contactId: payment.contact_id || undefined,
        tags,
        oppStatus: inst.move_opp_stage || 'won',
        autoCreate: !!inst.auto_create_contact,
      });

      if (ghlId) {
        await query('UPDATE payments SET synced_ghl = 1, contact_id = ? WHERE id = ?', [ghlId, payment.id]);
      }

      const sourceMeta = metadata?.kind ? metadata : parsePublicPayMeta(metadata?.customStr4 || null);
      if (sourceMeta?.kind === 'invoice') {
        await query(`UPDATE invoices SET status = 'paid', paid_at = NOW(), pf_payment_id = ? WHERE id = ?`, [transactionId, sourceMeta.id]);
      }
      if (sourceMeta?.kind === 'payment_link') {
        await query('UPDATE payment_links SET uses_count = uses_count + 1 WHERE id = ?', [sourceMeta.id]);
      }
      if (sourceMeta?.kind === 'text2pay') {
        await query(`UPDATE text2pay SET status = 'paid', paid_at = NOW(), pf_payment_id = ? WHERE id = ?`, [transactionId, sourceMeta.id]);
      }
      if (sourceMeta?.kind === 'order_form') {
        await query('UPDATE order_forms SET submissions = submissions + 1 WHERE id = ?', [sourceMeta.id]);
      }
      if (sourceMeta?.kind === 'schedule_installment') {
        await query(`UPDATE schedule_installments SET status = 'paid', paid_at = NOW(), pf_payment_id = ? WHERE id = ?`, [transactionId, sourceMeta.id]);
      }
      if (sourceMeta?.couponCode) {
        await query('UPDATE coupons SET uses_count = uses_count + 1 WHERE location_id = ? AND code = ?', [locationId, sourceMeta.couponCode]);
      }

      if (payment.payment_type === 'subscription' && capturedInstrument.instrumentToken) {
        await query(
          `INSERT INTO subscriptions (location_id, contact_id, pf_token, payer_email, amount, frequency, status, next_billing)
           VALUES (?, ?, ?, ?, ?, 'monthly', 'active', DATE_ADD(CURDATE(), INTERVAL 1 MONTH))
           ON DUPLICATE KEY UPDATE
             payer_email = VALUES(payer_email),
             amount = VALUES(amount),
             status = 'active'`,
          [locationId, payment.contact_id || null, capturedInstrument.instrumentToken, payment.payer_email, payment.amount]
        );
      }
    }
  }

  const successRedirect = metadata?.successRedirect || `${process.env.NEXT_PUBLIC_APP_URL}/pay/success`;
  const cancelRedirect = metadata?.cancelRedirect || `${process.env.NEXT_PUBLIC_APP_URL}/pay/${metadata?.publicToken || ''}`;

  if (redirectMode === 'Y') {
    return NextResponse.redirect(new URL(success ? successRedirect : cancelRedirect));
  }

  return new NextResponse(success ? 'OK' : `FAILED: ${statusMessage}`, { status: 200 });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await request.text();
    const payload = Object.fromEntries(new URLSearchParams(body).entries());

    if (payload.basket_id || payload.BASKET_ID || request.nextUrl.searchParams.get('basket_id')) {
      return processAppsCallback(request, payload);
    }

    const ip   = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const itn  = payload;

    console.log('[ITN] IP:', ip, '| PF Payment ID:', itn.pf_payment_id);

    const locationId = itn.custom_str2;
    if (!locationId) return new NextResponse('Missing location', { status: 400 });

    const rows = await query<Installation[]>('SELECT * FROM installations WHERE location_id = ?', [locationId]);
    if (!rows.length) return new NextResponse('Not found', { status: 404 });
    const inst = rows[0];

    if (inst.environment === 'live' && PAYFAST_VALID_IPS.length > 2 && !PAYFAST_VALID_IPS.includes(ip)) {
      console.warn('[ITN] Invalid IP:', ip);
      return new NextResponse('Invalid IP', { status: 403 });
    }

    // old flow no longer primary, but keep support path disabled by signature mismatch guard
    return new NextResponse('Unsupported legacy ITN payload', { status: 400 });
  }

  const payload = Object.fromEntries(request.nextUrl.searchParams.entries());
  return processAppsCallback(request, payload);
}

export async function GET(request: NextRequest) {
  const payload = Object.fromEntries(request.nextUrl.searchParams.entries());
  return processAppsCallback(request, payload);
}
