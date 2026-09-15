import { query } from './db';
import { getValidPayfastToken } from './payfast-ghl-token';

const GHL_WEBHOOK = 'https://backend.leadconnectorhq.com/payments/custom-provider/webhook';

export async function sendPayfastGhlNotification(input: {
  locationId: string;
  ghlTransactionId: string;
  chargeId: string;
  amount: number;
  contactId?: string | null;
  invoiceId?: string | null;
  orderId?: string | null;
  subscriptionId?: string | null;
  eventType?: string;
}) {
  const installations = await query<any[]>(
    'SELECT provider_api_key FROM payfast_ghl_installations WHERE location_id=? LIMIT 1',
    [input.locationId],
  );
  const apiKey = String(installations[0]?.provider_api_key || '');
  if (!apiKey) return { ok: false, status: 400, error: 'PayFast provider API key is missing' };
  const token = await getValidPayfastToken(input.locationId);
  if (!token) return { ok: false, status: 401, error: 'PayFast GHL token is unavailable' };

  const eventType = input.eventType || 'payment.captured';
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    event: eventType,
    chargeId: input.chargeId,
    ghlTransactionId: input.ghlTransactionId,
    locationId: input.locationId,
    apiKey,
    chargeSnapshot: {
      id: input.chargeId,
      status: 'succeeded',
      amount: Number(input.amount),
      chargeId: input.chargeId,
      chargedAt: now,
    },
  };
  if (process.env.PAYFAST_GHL_MARKETPLACE_APP_ID) payload.marketplaceAppId = process.env.PAYFAST_GHL_MARKETPLACE_APP_ID;
  if (input.contactId) payload.contactId = input.contactId;
  if (input.invoiceId) payload.invoiceId = input.invoiceId;
  if (input.orderId) payload.orderId = input.orderId;
  if (input.subscriptionId) payload.ghlSubscriptionId = input.subscriptionId;

  const response = await fetch(GHL_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, status: response.status, error: text };
  return { ok: true, status: response.status };
}
