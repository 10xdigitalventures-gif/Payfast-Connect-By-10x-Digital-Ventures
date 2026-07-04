import { NextRequest, NextResponse } from 'next/server';
import { query, Installation } from '@/lib/db';
import { verifyWhopSignature } from '@/lib/whop';
import { handlePaymentSync } from '@/lib/ghl';

// Whop -> our app webhook (Standard Webhooks signed).
// Mirrors the PayFast ITN success path: verify signature, mark the payment
// complete, then notify the CRM so invoices/orders are marked paid.
//
// Configure this URL in the Whop dashboard:
//   {NEXT_PUBLIC_APP_URL}/api/whop/webhook
export async function POST(request: NextRequest) {
  // RAW body first — required for signature verification (before JSON parse).
  const rawBody = await request.text();

  const msgId = request.headers.get('webhook-id');
  const timestamp = request.headers.get('webhook-timestamp');
  const signature = request.headers.get('webhook-signature');

  let data: any = null;
  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    data = null;
  }
  if (!data) return new NextResponse('Invalid payload', { status: 400 });

  const meta = (data?.data?.metadata as Record<string, string>) || {};
  const basketId = meta.basketId || meta.woo_order_id || '';
  const locationId = meta.location_id || '';

  if (!basketId || !locationId) {
    return new NextResponse('Missing metadata', { status: 400 });
  }

  const instRows = await query<Installation[]>(
    'SELECT * FROM installations WHERE location_id = ?',
    [locationId]
  );
  if (!instRows.length) return new NextResponse('Installation not found', { status: 404 });
  const inst = instRows[0];

  // ─── Security gate: verify signature before doing anything ──────────
  const secret = inst.whop_webhook_secret || '';
  if (!verifyWhopSignature({ msgId, timestamp, signature, rawBody, secret })) {
    console.warn('[Whop Webhook] signature verification failed — rejected.');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const eventType = String(data?.type || data?.action || '');

  // Handle failed payments: mark the pending row failed so the checkout poller
  // and the CRM see the decline instead of waiting for a timeout.
  if (eventType === 'payment.failed' || eventType === 'payment_failed') {
    await query(
      `UPDATE payments SET status = 'failed', raw_itn = ?, updated_at = NOW()
         WHERE pf_token = ? AND location_id = ? AND status = 'pending'`,
      [JSON.stringify(data), basketId, locationId]
    );
    return new NextResponse('OK', { status: 200 });
  }

  // Best-effort: reflect Whop-side refunds back into our records.
  if (eventType === 'refund.created' || eventType === 'refund_created') {
    const refundedWhopId = data?.data?.payment?.id || data?.data?.payment_id || data?.data?.id || '';
    if (refundedWhopId) {
      await query(
        `UPDATE payments SET status = 'refunded', updated_at = NOW()
           WHERE pf_payment_id = ? AND location_id = ?`,
        [String(refundedWhopId), locationId]
      );
    }
    return new NextResponse('OK', { status: 200 });
  }

  // Only act on successful payments beyond this point.
  const isSuccess = eventType === 'payment.succeeded' || eventType === 'payment_succeeded';
  if (!isSuccess) {
    return new NextResponse('Ignored', { status: 200 });
  }

  const paymentRows = await query<any[]>(
    `SELECT * FROM payments WHERE pf_token = ? AND location_id = ? ORDER BY id DESC LIMIT 1`,
    [basketId, locationId]
  );
  if (!paymentRows.length) return new NextResponse('Payment not found', { status: 404 });
  const payment = paymentRows[0];

  // Idempotency — Whop can retry/duplicate webhooks.
  if (payment.status === 'complete') {
    return new NextResponse('Already processed', { status: 200 });
  }

  const whopPaymentId = data?.data?.id ? String(data.data.id) : basketId;
  // Capture the membership id for subscriptions so we can cancel it later.
  const whopMembershipId = data?.data?.membership?.id ? String(data.data.membership.id) : null;

  let metadata: any = null;
  try {
    metadata = payment.item_description ? JSON.parse(payment.item_description) : null;
  } catch {
    metadata = null;
  }

  await query(
    `UPDATE payments SET pf_payment_id = ?, status = 'complete', whop_membership_id = COALESCE(?, whop_membership_id), raw_itn = ?, updated_at = NOW() WHERE id = ?`,
    [whopPaymentId, whopMembershipId, JSON.stringify(data), payment.id]
  );

  // ─── Notify the CRM (identical contract to the PayFast flow) ────────
  if (payment.custom_str3) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ghl/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId,
        ghlTransactionId: payment.custom_str3,
        chargeId: whopPaymentId,
        amount: payment.amount,
        contactId: metadata?.contactId || payment.contact_id || null,
        invoiceId: metadata?.invoiceId || null,
        orderId: metadata?.orderId || null,
        eventType: payment.payment_type === 'subscription' ? 'subscription.charged' : 'payment.captured',
      }),
    }).catch((e) => console.error('[Whop→CRM Notify]', e));
  } else {
    // Standalone (public pay link / funnel) flow — sync contact + tags.
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

    const sourceMeta = metadata?.kind ? metadata : null;
    if (sourceMeta?.kind === 'invoice') {
      await query(`UPDATE invoices SET status = 'paid', paid_at = NOW(), pf_payment_id = ? WHERE id = ?`, [whopPaymentId, sourceMeta.id]);
    }
    if (sourceMeta?.kind === 'payment_link') {
      await query('UPDATE payment_links SET uses_count = uses_count + 1 WHERE id = ?', [sourceMeta.id]);
    }
    if (sourceMeta?.kind === 'text2pay') {
      await query(`UPDATE text2pay SET status = 'paid', paid_at = NOW(), pf_payment_id = ? WHERE id = ?`, [whopPaymentId, sourceMeta.id]);
    }
    if (sourceMeta?.kind === 'order_form') {
      await query('UPDATE order_forms SET submissions = submissions + 1 WHERE id = ?', [sourceMeta.id]);
    }
    if (sourceMeta?.kind === 'schedule_installment') {
      await query(`UPDATE schedule_installments SET status = 'paid', paid_at = NOW(), pf_payment_id = ? WHERE id = ?`, [whopPaymentId, sourceMeta.id]);
    }
  }

  return new NextResponse('OK', { status: 200 });
}

export async function GET() {
  return NextResponse.json({ status: 'ok', provider: 'Whop webhook receiver' });
}
