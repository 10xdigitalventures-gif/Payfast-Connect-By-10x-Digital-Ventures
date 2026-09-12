import { NextRequest, NextResponse } from 'next/server';
import { query, Installation } from '@/lib/db';
import { getValidToken } from '@/lib/ghl';
import { recordOrderPayment } from '@/lib/ghl-orders';

const GHL_WEBHOOK = 'https://backend.leadconnectorhq.com/payments/custom-provider/webhook';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { locationId, ghlTransactionId, chargeId, amount, contactId, invoiceId, subscriptionId, orderId,
    eventType = 'payment.captured' } = body;
  if (!locationId || !ghlTransactionId || !chargeId) return NextResponse.json({ error: 'locationId, ghlTransactionId and chargeId required' }, { status: 400 });

  const rows = await query<Installation[]>('SELECT * FROM installations WHERE location_id=? LIMIT 1', [locationId]);
  if (!rows.length) return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
  const inst = rows[0] as Installation & { provider_api_key?: string };
  if (!inst.provider_api_key) return NextResponse.json({ error: 'Provider API key is missing; reconnect the provider in HighLevel' }, { status: 400 });
  const token = await getValidToken(locationId);
  if (!token) return NextResponse.json({ error: 'HighLevel access token is unavailable' }, { status: 401 });
  const now = Math.floor(Date.now() / 1000);

  let paymentMethodLabel = 'PayFast';
  try {
    const provRows = await query<any[]>(`SELECT provider FROM payments WHERE (pf_payment_id=? OR pf_token=? OR custom_str3=?) AND location_id=? ORDER BY id DESC LIMIT 1`,
      [chargeId, chargeId, ghlTransactionId, locationId]);
    if (provRows[0]?.provider === 'whop') paymentMethodLabel = 'Whop';
  } catch (error) { console.warn('[CRM Notify] provider lookup failed', error); }

  if (orderId) {
    try { await recordOrderPayment(locationId, orderId, { amount: Number(amount), transactionId: chargeId, paymentMethod: paymentMethodLabel }); }
    catch (error) { console.warn('[CRM Notify] order payment recording failed', error); }
  }

  const payload: Record<string, unknown> = {
    event: eventType, chargeId, ghlTransactionId, locationId, apiKey: inst.provider_api_key,
    chargeSnapshot: { id: chargeId, status: 'succeeded', amount: Number(amount), chargeId, chargedAt: now },
  };
  if (process.env.GHL_MARKETPLACE_APP_ID) payload.marketplaceAppId = process.env.GHL_MARKETPLACE_APP_ID;
  if (invoiceId) payload.invoiceId = invoiceId;
  if (contactId) payload.contactId = contactId;
  if (subscriptionId) payload.ghlSubscriptionId = subscriptionId;

  if (['subscription.charged','subscription.trialing','subscription.active','subscription.updated'].includes(eventType)) {
    const trialEnd = body.trialEndsAt ? Math.floor(new Date(body.trialEndsAt).getTime() / 1000) : 0;
    const periodEnd = body.periodEnd ? Math.floor(new Date(body.periodEnd).getTime() / 1000) : now + 30 * 86400;
    payload.subscriptionSnapshot = { id: body.providerSubscriptionId || subscriptionId || chargeId, status: eventType === 'subscription.trialing' ? 'trialing' : 'active',
      trialEnd, createdAt: body.createdAt ? Math.floor(new Date(body.createdAt).getTime() / 1000) : now, nextCharge: periodEnd };
    if (eventType !== 'subscription.charged') { delete payload.chargeId; delete payload.chargeSnapshot; payload.ghlSubscriptionId = subscriptionId || chargeId; }
  }

  try {
    const res = await fetch(GHL_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    const responseText = await res.text();
    console.log('[CRM Notify]', eventType, res.status, responseText);
    if (!res.ok) return NextResponse.json({ error: `CRM webhook failed: ${res.status}`, details: responseText }, { status: 502 });
    await query(`UPDATE payments SET synced_ghl=1 WHERE (pf_payment_id=? OR pf_token=?) AND location_id=?`, [chargeId, chargeId, locationId]);
    return NextResponse.json({ success: true, ghlStatus: res.status });
  } catch (error) {
    console.error('[CRM Notify Error]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
