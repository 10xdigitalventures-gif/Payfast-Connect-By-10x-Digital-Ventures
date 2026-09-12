import crypto from 'crypto';

export type SwichEnvironment = 'live' | 'sandbox';

export interface SwichCheckoutParams {
  clientId: string;
  secretKey: string;
  checkoutUrl: string;
  environment?: SwichEnvironment;
  customerTransactionId: string;
  orderId: string;
  amount: string | number;
  returnUrl: string;
  callbackUrl: string;
  customerEmail?: string;
  customerMobile?: string;
  description?: string;
  channel?: string;
  transactionType?: string;
  currency?: string;
}

function hmac(value: string, secret: string) {
  return crypto.createHmac('sha256', secret.trim()).update(value).digest('hex');
}

export function normalizeSwichAmount(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid Swich amount');
  return amount.toFixed(2);
}

export function buildSwichRequestChecksum(params: Pick<SwichCheckoutParams, 'customerTransactionId' | 'orderId' | 'amount' | 'secretKey'>) {
  const amount = normalizeSwichAmount(params.amount);
  return hmac(`SWRequest:${params.customerTransactionId}:${params.orderId}:${amount}`, params.secretKey);
}

export function verifySwichCallback(data: Record<string, string>, secretKey: string) {
  const customerTransactionId = data.CustomerTransactionId || data.customerTransactionId || '';
  const orderId = data.OrderId || data.orderId || '';
  const amount = data.Amount || data.amount || '';
  const status = data.Status || data.status || '';
  const received = (data.checksum || data.Checksum || '').trim().toLowerCase();
  if (!customerTransactionId || !orderId || !amount || !status || !received || !secretKey) return false;
  const expected = hmac(`SWCallback:${customerTransactionId}:${orderId}:${amount}:${status}`, secretKey).toLowerCase();
  if (received.length !== expected.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected)); } catch { return false; }
}

export function buildSwichCheckoutForm(params: SwichCheckoutParams) {
  if (!params.clientId.trim() || !params.secretKey.trim() || !params.checkoutUrl.trim()) throw new Error('Swich credentials and checkout URL are required');
  const amount = normalizeSwichAmount(params.amount);
  const fields: Record<string, string> = {
    clientId: params.clientId.trim(), customerTransactionId: params.customerTransactionId,
    orderId: params.orderId, amount, currency: (params.currency || 'PKR').toUpperCase(),
    channel: params.channel || 'ALL', transactionType: params.transactionType || 'PURCHASE',
    returnUrl: params.returnUrl, callbackUrl: params.callbackUrl,
    customerEmail: params.customerEmail || '', customerMobile: params.customerMobile || '',
    description: params.description || '',
  };
  fields.checksum = buildSwichRequestChecksum({ ...params, amount });
  return { actionUrl: params.checkoutUrl.trim(), fields };
}
