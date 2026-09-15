import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { extractCapturedInstrument, verifySignature } from '@/lib/payfast';
import { savePaymentInstrument } from '@/lib/payment-instruments';
import { sendPayfastGhlNotification } from '@/lib/payfast-ghl-notify';

function value(record: Record<string, string>, ...keys: string[]) {
  for (const key of keys) if (record[key] != null && record[key] !== '') return record[key];
  return '';
}
function changed(result: unknown) { return Number((result as { affectedRows?: number } | null)?.affectedRows || 0) === 1; }
function popup(status: 'complete' | 'failed' | 'cancelled') {
  const message = JSON.stringify({ type: 'payfast_popup_result', status });
  const title = status === 'complete' ? 'Payment complete' : status === 'cancelled' ? 'Payment cancelled' : 'Payment not completed';
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:Arial;text-align:center;padding:48px"><h2>${title}</h2><p>This window will close automatically.</p><button onclick="window.close()">Close</button><script>try{if(window.opener)window.opener.postMessage(${JSON.stringify(message)},'*')}catch(e){}setTimeout(function(){window.close()},1500)</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function processCallback(request: NextRequest, payload: Record<string, string>) {
  const locationId = value(payload, 'location_id') || request.nextUrl.searchParams.get('location_id') || '';
  const basketId = value(payload, 'basket_id', 'BASKET_ID') || request.nextUrl.searchParams.get('basket_id') || '';
  const redirect = value(payload, 'redirect') || request.nextUrl.searchParams.get('redirect') || '';
  const cancelled = request.nextUrl.searchParams.get('cancelled') === 'Y';
  if (!locationId || !basketId) return new NextResponse('Missing callback context', { status: 400 });

  const payments = await query<any[]>('SELECT * FROM payments WHERE pf_token=? AND location_id=? AND provider=\'payfast\' ORDER BY id DESC LIMIT 1', [basketId, locationId]);
  if (!payments.length) return new NextResponse('Payment not found', { status: 404 });
  const payment = payments[0];

  if (redirect === 'Y' && cancelled && !value(payload, 'validation_hash', 'VALIDATION_HASH')) {
    await query(`UPDATE payments SET status='failed',raw_itn=?,updated_at=NOW() WHERE id=? AND status='pending'`, [JSON.stringify({ cancelled: true }), payment.id]);
    return popup(payment.status === 'complete' ? 'complete' : 'cancelled');
  }

  const installations = await query<any[]>('SELECT * FROM payfast_ghl_installations WHERE location_id=? LIMIT 1', [locationId]);
  const installation = installations[0];
  if (!installation) return new NextResponse('PayFast installation not found', { status: 404 });
  if (!verifySignature(payload, installation.merchant_key, installation.merchant_id)) return new NextResponse('Invalid signature', { status: 400 });

  let metadata: any = null;
  try { metadata = payment.item_description ? JSON.parse(payment.item_description) : null; } catch {}
  const success = value(payload, 'err_code', 'ERR_CODE') === '000';
  const chargeId = value(payload, 'transaction_id', 'TRANSACTION_ID') || payment.pf_payment_id || basketId;
  const transition = await query<any>(
    `UPDATE payments SET pf_payment_id=?,status=?,raw_itn=?,updated_at=NOW() WHERE id=? AND status='pending'`,
    [chargeId, success ? 'complete' : 'failed', JSON.stringify(payload), payment.id],
  );
  const firstTerminal = changed(transition);
  const complete = firstTerminal ? success : payment.status === 'complete';

  if (complete && firstTerminal) {
    const instrument = extractCapturedInstrument(payload);
    if (instrument.instrumentToken) {
      await savePaymentInstrument(locationId, {
        provider: 'payfast',
        contactId: payment.contact_id || null,
        instrumentToken: instrument.instrumentToken,
        instrumentAlias: instrument.alias || value(payload, 'PaymentName', 'PAYMENT_NAME') || null,
        cardLastFour: instrument.cardLastFour,
        expiryDate: instrument.expiryDate,
        isDefault: payment.payment_type === 'subscription',
      });
    }
  }

  if (complete && payment.custom_str3) {
    const claim = await query<any>(`UPDATE payments SET synced_ghl=-1,updated_at=NOW()
      WHERE id=? AND status='complete' AND COALESCE(synced_ghl,0)=0`, [payment.id]);
    if (changed(claim)) {
      try {
        const result = await sendPayfastGhlNotification({
          locationId, ghlTransactionId: payment.custom_str3, chargeId, amount: Number(payment.amount),
          contactId: metadata?.contactId || payment.contact_id || null,
          invoiceId: metadata?.invoiceId || null, orderId: metadata?.orderId || null,
          subscriptionId: metadata?.subscriptionId || null,
          eventType: payment.payment_type === 'subscription' ? 'subscription.charged' : 'payment.captured',
        });
        if (result.ok) {
          await query('UPDATE payments SET synced_ghl=1,updated_at=NOW() WHERE id=? AND synced_ghl=-1', [payment.id]);
        } else if (result.status === 429 || result.status >= 500) {
          await query('UPDATE payments SET synced_ghl=0,updated_at=NOW() WHERE id=? AND synced_ghl=-1', [payment.id]);
        }
      } catch (error) {
        console.error('[PayFast App ITN] CRM notification failed', error);
        await query('UPDATE payments SET synced_ghl=0,updated_at=NOW() WHERE id=? AND synced_ghl=-1', [payment.id]);
      }
    }
  }

  if (redirect === 'Y') return popup(complete ? 'complete' : 'failed');
  return new NextResponse(complete ? 'OK' : `FAILED: ${value(payload, 'err_msg', 'ERR_MSG')}`, { status: 200 });
}

export async function POST(request: NextRequest) {
  const payload = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')
    ? Object.fromEntries(new URLSearchParams(await request.text()).entries())
    : Object.fromEntries(request.nextUrl.searchParams.entries());
  return processCallback(request, payload);
}
export async function GET(request: NextRequest) {
  return processCallback(request, Object.fromEntries(request.nextUrl.searchParams.entries()));
}
