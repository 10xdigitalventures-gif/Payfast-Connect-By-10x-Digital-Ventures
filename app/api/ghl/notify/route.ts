import { NextRequest, NextResponse } from 'next/server';
import { query, Installation } from '@/lib/db';
import { getValidToken } from '@/lib/ghl';
import { recordOrderPayment } from '@/lib/ghl-orders';

const GHL_WEBHOOK = 'https://backend.leadconnectorhq.com/payments/custom-provider/webhook';

// Called internally (from GoPayFast ITN handler) after payment is confirmed
// Sends payment.captured webhook to CRM so it marks invoice as Paid
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    locationId,
    ghlTransactionId, // the transaction ID CRM gave us
    chargeId,         // our pf_payment_id
    amount,
    contactId,
    invoiceId,
    subscriptionId,
    orderId,          // newly added
    eventType = 'payment.captured',
  } = body;

  if (!locationId || !ghlTransactionId) {
    return NextResponse.json({ error: 'locationId and ghlTransactionId required' }, { status: 400 });
  }

  // Get installation to find app ID
  const rows = await query<Installation[]>(
    'SELECT * FROM installations WHERE location_id = ?',
    [locationId]
  );

  if (!rows.length) {
    return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
  }

  const now = Math.floor(Date.now() / 1000);

  // Resolve the owning provider so the CRM order shows the correct method label.
  let paymentMethodLabel = 'PayFast';
  try {
    const provRows = await query<any[]>(
      `SELECT provider FROM payments
         WHERE (pf_payment_id = ? OR pf_token = ? OR custom_str3 = ?) AND location_id = ?
         ORDER BY id DESC LIMIT 1`,
      [chargeId, chargeId, ghlTransactionId, locationId]
    );
    if (provRows.length && provRows[0].provider === 'whop') paymentMethodLabel = 'Whop';
  } catch (err) {
    console.warn('[CRM Notify] provider lookup failed, defaulting to PayFast', err);
  }

  // 1. Record Order Payment if orderId is provided
  if (orderId) {
    try {
      await recordOrderPayment(locationId, orderId, {
        amount: parseFloat(amount),
        transactionId: chargeId,
        paymentMethod: paymentMethodLabel,
      });
    } catch (err) {
      console.warn('[CRM Notify] Order payment recording failed', err);
      // We continue anyway to send the webhook
    }
  }

  // Build CRM webhook payload
  const payload: Record<string, unknown> = {
    event:           eventType,
    chargeId:        chargeId,
    ghlTransactionId: ghlTransactionId,
    locationId:      locationId,
    chargeSnapshot: {
      status:    'succeeded',
      amount:    parseFloat(amount),
      chargeId:  chargeId,
      chargedAt: now,
    },
  };

  if (invoiceId)      payload.invoiceId      = invoiceId;
  if (contactId)      payload.contactId      = contactId;
  if (subscriptionId) payload.ghlSubscriptionId = subscriptionId;

  // For subscription events — build the correct subscriptionSnapshot shape.
  // GHL expects: subscription.trialing, subscription.active, subscription.updated,
  // subscription.charged (all routed to the same CRM webhook endpoint).
  if (
    eventType === 'subscription.charged' ||
    eventType === 'subscription.trialing' ||
    eventType === 'subscription.active' ||
    eventType === 'subscription.updated'
  ) {
    const trialEnd = body.trialEndsAt ? Math.floor(new Date(body.trialEndsAt).getTime() / 1000) : 0;
    const periodEnd = body.periodEnd ? Math.floor(new Date(body.periodEnd).getTime() / 1000) : now + 30 * 24 * 3600;
    const subStatus =
      eventType === 'subscription.trialing' ? 'trialing'
      : eventType === 'subscription.active'  ? 'active'
      : eventType === 'subscription.updated' ? 'active'
      : 'active'; // subscription.charged
    payload.subscriptionSnapshot = {
      id: body.subscriptionId || subscriptionId || '',
      status: subStatus,
      trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    };
    if (eventType !== 'subscription.charged') {
      // For non-charge lifecycle events GHL doesn't need chargeId / chargeSnapshot
      // but we keep them in case the implementation evolves.
      delete payload.chargeId;
      delete payload.chargeSnapshot;
      payload.ghlSubscriptionId = body.subscriptionId || subscriptionId || '';
    }
  }

  try {
    const res = await fetch(GHL_WEBHOOK, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getValidToken(locationId)}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    console.log('[CRM Notify]', eventType, res.status, responseText);

    if (!res.ok) {
      throw new Error(`CRM webhook failed: ${res.status} ${responseText}`);
    }

    // Update our payment record as CRM-notified
    await query(
      `UPDATE payments SET synced_ghl = 1 WHERE pf_payment_id = ? AND location_id = ?`,
      [chargeId, locationId]
    );

    return NextResponse.json({ success: true, ghlStatus: res.status });
  } catch (err) {
    console.error('[CRM Notify Error]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
