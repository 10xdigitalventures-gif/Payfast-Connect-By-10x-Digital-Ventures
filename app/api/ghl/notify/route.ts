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

  // 1. Record Order Payment if orderId is provided
  if (orderId) {
    try {
      await recordOrderPayment(locationId, orderId, {
        amount: parseFloat(amount),
        transactionId: chargeId,
        paymentMethod: 'Payfast',
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

  // For subscription events
  if (eventType === 'subscription.charged') {
    payload.subscriptionSnapshot = {
      status:       'active',
      currentPeriodStart: now,
      currentPeriodEnd:   now + 30 * 24 * 3600,
    };
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
