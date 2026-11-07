import { getValidWhopGhlToken } from './whop-ghl-token';

export type WhopOrderAttestation = { ok: true } | { ok: false; status: number; error: string };

/**
 * The GHL checkout iframe sends untrusted browser-side payment data.
 * Before creating a real Whop charge, verify order amount/currency and tenant
 * against HighLevel's authenticated API v3 order record.
 */
export async function attestWhopGhlOrder(input: {
  locationId: string; orderId: string; amount: number; currency: string; contactId?: string;
}): Promise<WhopOrderAttestation> {
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(input.locationId) ||
      !/^[A-Za-z0-9_-]{1,255}$/.test(input.orderId)) {
    return { ok: false, status: 422, error: 'Verified HighLevel order ID is required for payment checkout' };
  }
  const token = await getValidWhopGhlToken(input.locationId);
  if (!token) return { ok: false, status: 503, error: 'HighLevel token is unavailable for order verification' };
  try {
    const path = encodeURIComponent(input.orderId);
    const query = new URLSearchParams({ altId: input.locationId, locationId: input.locationId });
    const response = await fetch('https://services.leadconnectorhq.com/payments/orders/' + path + '?' + query.toString(), {
      headers: { Authorization: 'Bearer ' + token, Version: 'v3', Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return { ok: false, status: 502, error: 'Unable to verify HighLevel order' };
    const data: any = await response.json();
    const order = data?.order || data?.data || data;
    const canonicalAmount = Number(order?.amount);
    const orderCurrency = String(order?.currency || '').toUpperCase();
    const orderId = String(order?._id || order?.id || '');
    const orderLocation = String(order?.altId || '');
    if (orderId !== input.orderId || orderLocation !== input.locationId ||
        !Number.isFinite(canonicalAmount) || canonicalAmount <= 0 ||
        !Number.isFinite(input.amount) || Math.abs(canonicalAmount - input.amount) > 0.005 ||
        orderCurrency !== input.currency.toUpperCase() ||
        (input.contactId && order?.contactId && String(order.contactId) !== input.contactId) ||
        String(order?.paymentStatus || '').toLowerCase() === 'paid') {
      return { ok: false, status: 409, error: 'HighLevel order amount, currency or identity mismatch' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: 'HighLevel order verification failed' };
  }
}
