import { NextRequest, NextResponse } from 'next/server';
import { query, Installation } from '@/lib/db';
import { extractCapturedInstrument, verifySignature, PAYFAST_VALID_IPS } from '@/lib/payfast';
import { handlePaymentSync } from '@/lib/ghl';
import { parsePublicPayMeta } from '@/lib/public-pay';
import { savePaymentInstrument } from '@/lib/payment-instruments';

function getValue(record: Record<string, string>, ...keys: string[]) { for (const key of keys) { const value = record[key]; if (value != null && value !== '') return value; } return ''; }
function affectedRows(result: unknown) { return Number((result as { affectedRows?: number } | null)?.affectedRows || 0); }
function popupCloseResponse(status: 'complete' | 'failed' | 'cancelled') {
  const title = status === 'complete' ? 'Payment complete' : status === 'cancelled' ? 'Payment cancelled' : 'Payment not completed';
  const message = status === 'complete' ? 'Your payment was confirmed.' : status === 'cancelled' ? 'No charge was made.' : 'The payment was declined or cancelled.';
  const popupMessage = JSON.stringify({ type: 'payfast_popup_result', status });
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="margin:0;background:#0b0f19;color:#fff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center"><main><div style="font-size:38px">${status === 'complete' ? '✓' : '×'}</div><h2>${title}</h2><p style="color:#aab4c8">${message}<br>This window will close automatically.</p><button onclick="window.close()" style="padding:10px 18px;border:0;border-radius:8px;cursor:pointer">Close window</button></main><script>try{if(window.opener){window.opener.postMessage(${JSON.stringify(popupMessage)},'*')}}catch(e){};setTimeout(function(){window.close()},1500);</script></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function notifyHighLevelOnce(payment: any, metadata: any, locationId: string, chargeId: string) {
  if (!payment.custom_str3) return;

  // Atomically claim the notification. PayFast can call notify_url and
  // return_url concurrently; only one request may send payment.captured.
  const claim = await query<any>(`UPDATE payments SET synced_ghl=-1,updated_at=NOW()
    WHERE id=? AND status='complete' AND COALESCE(synced_ghl,0)=0`, [payment.id]);
  if (affectedRows(claim) !== 1) return;

  try {
    const notifyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ghl/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId,
        ghlTransactionId: payment.custom_str3,
        chargeId,
        amount: payment.amount,
        contactId: metadata?.contactId || payment.contact_id || null,
        invoiceId: metadata?.invoiceId || null,
        orderId: metadata?.orderId || null,
        subscriptionId: metadata?.subscriptionId || null,
        eventType: payment.payment_type === 'subscription' ? 'subscription.charged' : 'payment.captured',
      }),
    });

    if (notifyResponse.ok) {
      await query('UPDATE payments SET synced_ghl=1,updated_at=NOW() WHERE id=? AND synced_ghl=-1', [payment.id]);
      return;
    }

    const body = await notifyResponse.text();
    console.error('[APPS→CRM Notify]', notifyResponse.status, body);
    // Retry only transient failures. A permanent 4xx remains claimed so
    // duplicate callbacks cannot hammer HighLevel repeatedly.
    if (notifyResponse.status === 429 || notifyResponse.status >= 500) {
      await query('UPDATE payments SET synced_ghl=0,updated_at=NOW() WHERE id=? AND synced_ghl=-1', [payment.id]);
    }
  } catch (error) {
    console.error('[APPS→CRM Notify]', error);
    await query('UPDATE payments SET synced_ghl=0,updated_at=NOW() WHERE id=? AND synced_ghl=-1', [payment.id]);
  }
}

async function processAppsCallback(request: NextRequest, payload: Record<string, string>) {
  const locationId = getValue(payload, 'location_id') || request.nextUrl.searchParams.get('location_id') || '';
  const basketId = getValue(payload, 'basket_id', 'BASKET_ID') || request.nextUrl.searchParams.get('basket_id') || '';
  const errCode = getValue(payload, 'err_code', 'ERR_CODE');
  const transactionId = getValue(payload, 'transaction_id', 'TRANSACTION_ID');
  const statusMessage = getValue(payload, 'err_msg', 'ERR_MSG');
  const paymentMethod = getValue(payload, 'PaymentName', 'PAYMENT_NAME');
  const redirectMode = getValue(payload, 'redirect') || request.nextUrl.searchParams.get('redirect') || '';
  const explicitlyCancelled = request.nextUrl.searchParams.get('cancelled') === 'Y';
  const capturedInstrument = extractCapturedInstrument(payload);
  if (!locationId || !basketId) return new NextResponse('Missing callback context', { status: 400 });

  const paymentRows = await query<any[]>(`SELECT * FROM payments WHERE pf_token=? AND location_id=? ORDER BY id DESC LIMIT 1`, [basketId, locationId]);
  if (!paymentRows.length) return new NextResponse('Payment not found', { status: 404 });
  const payment = paymentRows[0];
  if (redirectMode === 'Y' && explicitlyCancelled && !getValue(payload, 'validation_hash', 'VALIDATION_HASH')) {
    await query(`UPDATE payments SET status='failed',raw_itn=?,updated_at=NOW() WHERE id=? AND status='pending'`, [JSON.stringify({ cancelled: true }), payment.id]);
    return popupCloseResponse(payment.status === 'complete' ? 'complete' : 'cancelled');
  }

  const instRows = await query<Installation[]>('SELECT * FROM installations WHERE location_id=?', [locationId]);
  if (!instRows.length) return new NextResponse('Installation not found', { status: 404 });
  const inst = instRows[0];
  if (!verifySignature(payload, inst.merchant_key, inst.merchant_id)) return new NextResponse('Invalid signature', { status: 400 });

  let metadata: any = null;
  try { metadata = payment.item_description ? JSON.parse(payment.item_description) : null; } catch { metadata = null; }
  const callbackSuccess = errCode === '000';
  const chargeId = transactionId || payment.pf_payment_id || basketId;
  const desiredStatus = callbackSuccess ? 'complete' : 'failed';
  const transition = await query<any>(`UPDATE payments SET pf_payment_id=?,status=?,raw_itn=?,updated_at=NOW()
    WHERE id=? AND status='pending'`, [chargeId, desiredStatus, JSON.stringify({ ...payload, paymentMethod }), payment.id]);
  const firstTerminalTransition = affectedRows(transition) === 1;
  const paymentComplete = firstTerminalTransition ? callbackSuccess : payment.status === 'complete';

  if (paymentComplete) {
    if (firstTerminalTransition && capturedInstrument.instrumentToken) {
      await savePaymentInstrument(locationId, {
        instrumentToken: capturedInstrument.instrumentToken,
        instrumentAlias: capturedInstrument.alias || paymentMethod || null,
        cardLastFour: capturedInstrument.cardLastFour,
        expiryDate: capturedInstrument.expiryDate,
        isDefault: payment.payment_type === 'subscription',
      });
    }

    if (payment.custom_str3) {
      await notifyHighLevelOnce(payment, metadata, locationId, chargeId);
    } else if (firstTerminalTransition) {
      const tags = (inst.tag_on_payment || 'paid,customer').split(',').map((t) => t.trim()).filter(Boolean);
      const ghlId = await handlePaymentSync({ locationId, email: payment.payer_email, firstName: payment.payer_first || '', lastName: payment.payer_last || '',
        contactId: payment.contact_id || undefined, tags, oppStatus: inst.move_opp_stage || 'won', autoCreate: !!inst.auto_create_contact });
      if (ghlId) await query('UPDATE payments SET synced_ghl=1,contact_id=? WHERE id=?', [ghlId, payment.id]);
      const sourceMeta = metadata?.kind ? metadata : parsePublicPayMeta(metadata?.customStr4 || null);
      if (sourceMeta?.kind === 'invoice') await query(`UPDATE invoices SET status='paid',paid_at=NOW(),pf_payment_id=? WHERE id=?`, [chargeId, sourceMeta.id]);
      if (sourceMeta?.kind === 'payment_link') await query('UPDATE payment_links SET uses_count=uses_count+1 WHERE id=?', [sourceMeta.id]);
      if (sourceMeta?.kind === 'text2pay') await query(`UPDATE text2pay SET status='paid',paid_at=NOW(),pf_payment_id=? WHERE id=?`, [chargeId, sourceMeta.id]);
      if (sourceMeta?.kind === 'order_form') await query('UPDATE order_forms SET submissions=submissions+1 WHERE id=?', [sourceMeta.id]);
      if (sourceMeta?.kind === 'schedule_installment') await query(`UPDATE schedule_installments SET status='paid',paid_at=NOW(),pf_payment_id=? WHERE id=?`, [chargeId, sourceMeta.id]);
      if (sourceMeta?.couponCode) await query('UPDATE coupons SET uses_count=uses_count+1 WHERE location_id=? AND code=?', [locationId, sourceMeta.couponCode]);
      if (payment.payment_type === 'subscription' && capturedInstrument.instrumentToken) await query(`INSERT INTO subscriptions (location_id,contact_id,pf_token,payer_email,amount,frequency,status,next_billing)
        VALUES (?,?,?,?,?,'monthly','active',DATE_ADD(CURDATE(),INTERVAL 1 MONTH)) ON DUPLICATE KEY UPDATE payer_email=VALUES(payer_email),amount=VALUES(amount),status='active'`,
        [locationId, payment.contact_id || null, capturedInstrument.instrumentToken, payment.payer_email, payment.amount]);
    }
  }

  if (redirectMode === 'Y') return popupCloseResponse(paymentComplete ? 'complete' : 'failed');
  return new NextResponse(paymentComplete ? 'OK' : `FAILED: ${statusMessage}`, { status: 200 });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const payload = Object.fromEntries(new URLSearchParams(await request.text()).entries());
    if (payload.basket_id || payload.BASKET_ID || request.nextUrl.searchParams.get('basket_id')) return processAppsCallback(request, payload);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    console.log('[ITN] IP:', ip, '| PF Payment ID:', payload.pf_payment_id);
    const locationId = payload.custom_str2;
    if (!locationId) return new NextResponse('Missing location', { status: 400 });
    const rows = await query<Installation[]>('SELECT * FROM installations WHERE location_id=?', [locationId]);
    if (!rows.length) return new NextResponse('Not found', { status: 404 });
    if (rows[0].environment === 'live' && PAYFAST_VALID_IPS.length > 2 && !PAYFAST_VALID_IPS.includes(ip)) return new NextResponse('Invalid IP', { status: 403 });
    return new NextResponse('Unsupported legacy ITN payload', { status: 400 });
  }
  return processAppsCallback(request, Object.fromEntries(request.nextUrl.searchParams.entries()));
}
export async function GET(request: NextRequest) { return processAppsCallback(request, Object.fromEntries(request.nextUrl.searchParams.entries())); }
