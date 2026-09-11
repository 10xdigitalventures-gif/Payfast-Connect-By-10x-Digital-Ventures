import crypto from 'crypto';

export const PAYFAST_POST_URL = 'https://ipg1.apps.net.pk/Ecommerce/api/Transaction/PostTransaction';
export const PAYFAST_TOKEN_URL = 'https://ipg1.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken';

export const PAYFAST_VALID_IPS = [
  '::1', '127.0.0.1',
];

export interface PaymentParams {
  merchantId: string;
  merchantKey: string;
  merchantName?: string | null;
  storeId?: string | null;
  passphrase?: string | null;
  environment?: 'live' | 'sandbox';
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  nameFirst?: string;
  nameLast?: string;
  emailAddress?: string;
  phone?: string;
  amount: string;
  itemName: string;
  itemDescription?: string;
  customStr1?: string;
  customStr2?: string;
  customStr3?: string;
  customStr4?: string;
  mPaymentId?: string;
  currencyCode?: string;
}

export interface SubscriptionParams extends PaymentParams {
  frequency: '3' | '4' | '6';
  recurringAmount: string;
  billingDate?: string;
  cycles?: string;
}

export interface CapturedInstrumentDetails {
  instrumentToken: string | null;
  alias: string | null;
  cardLastFour: string | null;
  expiryDate: string | null;
}

export function normalizeCurrencyCode(value?: string | null): string {
  const normalized = String(value || 'PKR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(`Invalid ISO currency code: ${value || ''}`);
  }
  return normalized;
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function getAccessToken(params: PaymentParams, basketId: string) {
  const query = new URLSearchParams({
    MERCHANT_ID: params.merchantId.trim(),
    SECURED_KEY: params.merchantKey.trim(),
    TXNAMT: params.amount,
    BASKET_ID: basketId,
    CURRENCY_CODE: normalizeCurrencyCode(params.currencyCode),
  });

  const response = await fetch(`${PAYFAST_TOKEN_URL}?${query.toString()}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ACCESS_TOKEN) {
    throw new Error(data?.MESSAGE || data?.message || 'Unable to get PayFast access token');
  }

  return data.ACCESS_TOKEN as string;
}

export async function getMerchantAccessToken(params: {
  merchantId: string;
  merchantKey: string;
  amount: string;
  basketId: string;
  currencyCode?: string;
}) {
  return getAccessToken({
    merchantId: params.merchantId,
    merchantKey: params.merchantKey,
    amount: params.amount,
    itemName: 'Recurring Charge',
    returnUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    notifyUrl: 'https://example.com/notify',
    currencyCode: params.currencyCode,
  }, params.basketId);
}

function buildSignature(params: PaymentParams, basketId: string) {
  return sha256(`${params.merchantId.trim()}:${params.merchantKey.trim()}:${params.amount}:${basketId}`);
}

export function verifySignature(data: Record<string, string>, securedKey?: string | null, merchantId?: string | null): boolean {
  const validationHash = (data.validation_hash || data.VALIDATION_HASH || '').trim().toLowerCase();
  const basketId = (data.basket_id || data.BASKET_ID || '').trim();
  const errCode = (data.err_code || data.ERR_CODE || '').trim();

  if (!validationHash || !basketId || !securedKey || !merchantId) return false;

  const calculated = sha256(`${basketId}|${securedKey.trim()}|${merchantId.trim()}|${errCode}`).toLowerCase();
  if (validationHash.length !== calculated.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(validationHash), Buffer.from(calculated));
  } catch {
    return false;
  }
}

export async function buildPaymentForm(params: PaymentParams): Promise<{
  actionUrl: string;
  fields: Record<string, string>;
}> {
  const basketId = params.mPaymentId || `PF-${Date.now()}`;
  const token = await getAccessToken(params, basketId);
  const signature = buildSignature(params, basketId);
  const orderDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const storeId = params.storeId?.trim();

  const fields: Record<string, string> = {
    MERCHANT_ID: params.merchantId.trim(),
    MERCHANT_NAME: params.merchantName?.trim() || 'GoPayFast Merchant',
    TOKEN: token,
    PROCCODE: '00',
    TXNAMT: params.amount,
    CUSTOMER_MOBILE_NO: params.phone || '',
    CUSTOMER_EMAIL_ADDRESS: params.emailAddress || '',
    SIGNATURE: signature,
    VERSION: 'APP-GOPAYFAST-1.0',
    TXNDESC: params.itemDescription || params.itemName,
    SUCCESS_URL: encodeURIComponent(params.returnUrl),
    FAILURE_URL: encodeURIComponent(params.cancelUrl),
    BASKET_ID: basketId,
    ORDER_DATE: orderDate,
    CHECKOUT_URL: encodeURIComponent(params.notifyUrl),
    TRAN_TYPE: 'ECOMM_PURCHASE',
    CURRENCY_CODE: normalizeCurrencyCode(params.currencyCode),
  };

  if (storeId) fields.STORE_ID = storeId;

  return { actionUrl: PAYFAST_POST_URL, fields };
}

function transactionApiUrl(path: string, query: URLSearchParams) {
  const root = PAYFAST_TOKEN_URL.slice(0, PAYFAST_TOKEN_URL.lastIndexOf('/'));
  return `${root}/${path}?${query.toString()}`;
}

export async function getTemporaryToken(params: any) {
  const query = new URLSearchParams({
    merchant_user_id: params.merchantUserId,
    user_mobile_number: params.userMobileNumber,
    basket_id: params.basketId,
    txnamt: params.amount,
    account_type: params.accountType || '4',
    bank_code: params.bankCode,
    cnic_number: params.cnicNumber,
    account_number: params.accountNumber,
    account_title: params.accountTitle,
  });

  const response = await fetch(transactionApiUrl('token', query), {
    headers: { 'Authorization': `Bearer ${params.token}` }
  });
  return await response.json();
}

export async function performTokenizedTransaction(params: any) {
  const query = new URLSearchParams({
    instrument_token: params.instrumentToken,
    transaction_id: params.transactionId,
    merchant_user_id: params.merchantUserId,
    user_mobile_number: params.userMobileNumber,
    basket_id: params.basketId,
    order_date: params.orderDate,
    txndesc: params.description,
    txnamt: params.amount,
    otp: params.otp,
  });

  const response = await fetch(transactionApiUrl('tokenized', query), {
    headers: { 'Authorization': `Bearer ${params.token}` }
  });
  return await response.json();
}

export async function addPermanentInstrument(params: any) {
  const query = new URLSearchParams({
    instrument_token: params.instrumentToken,
    merchant_user_id: params.merchantUserId,
    user_mobile_number: params.userMobileNumber,
  });

  const response = await fetch(transactionApiUrl('add-permanent-payment-instrument', query), {
    headers: { 'Authorization': `Bearer ${params.token}` }
  });
  return await response.json();
}

export async function buildSubscriptionForm(params: SubscriptionParams) {
  return buildPaymentForm(params);
}

export function extractCapturedInstrument(data: Record<string, string>): CapturedInstrumentDetails {
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const value = data[key];
      if (value != null && value !== '') return value;
    }
    return '';
  };

  const instrumentToken = read(
    'instrument_token',
    'INSTRUMENT_TOKEN',
    'permanent_instrument_token',
    'PERMANENT_INSTRUMENT_TOKEN',
    'recurring_token',
    'RECURRING_TOKEN',
    'customer_token',
    'CUSTOMER_TOKEN',
    'payment_token',
    'PAYMENT_TOKEN'
  ) || null;

  const rawPan = read('card_number', 'CARD_NUMBER', 'masked_pan', 'MASKED_PAN', 'account_number', 'ACCOUNT_NUMBER');
  const digits = rawPan.replace(/\D/g, '');
  const cardLastFour = digits.length >= 4 ? digits.slice(-4) : null;

  const expiryMonth = read('expiry_month', 'EXPIRY_MONTH');
  const expiryYear = read('expiry_year', 'EXPIRY_YEAR');
  const expiryDate = expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : null;

  return {
    instrumentToken,
    alias: read('PaymentName', 'PAYMENT_NAME', 'instrument_alias', 'INSTRUMENT_ALIAS') || null,
    cardLastFour,
    expiryDate,
  };
}
