import crypto from 'crypto';
import { buildPaymentForm, normalizeCurrencyCode, verifySignature } from '../lib/payfast';

describe('PayFast checkout helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('normalizes the GHL currency instead of silently forcing PKR', () => {
    expect(normalizeCurrencyCode('usd')).toBe('USD');
    expect(normalizeCurrencyCode(' PKR ')).toBe('PKR');
    expect(normalizeCurrencyCode(undefined)).toBe('PKR');
    expect(() => normalizeCurrencyCode('dollars')).toThrow('Invalid ISO currency code');
  });

  test('passes currency to token and checkout, and omits an empty store ID', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ACCESS_TOKEN: 'token-123' }),
    } as Response);

    const result = await buildPaymentForm({
      merchantId: ' merchant ',
      merchantKey: ' secured ',
      storeId: '   ',
      returnUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/failure',
      notifyUrl: 'https://example.com/notify',
      amount: '25.00',
      itemName: 'USD product',
      currencyCode: 'usd',
      mPaymentId: 'basket-1',
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain('CURRENCY_CODE=USD');
    expect(result.fields.CURRENCY_CODE).toBe('USD');
    expect(result.fields.STORE_ID).toBeUndefined();
  });

  test('trims and includes a configured store ID', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ACCESS_TOKEN: 'token-123' }),
    } as Response);

    const result = await buildPaymentForm({
      merchantId: 'merchant',
      merchantKey: 'secured',
      storeId: ' store-42 ',
      returnUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/failure',
      notifyUrl: 'https://example.com/notify',
      amount: '10.00',
      itemName: 'Product',
      currencyCode: 'PKR',
      mPaymentId: 'basket-2',
    });

    expect(result.fields.STORE_ID).toBe('store-42');
  });

  test('verifies a valid callback hash despite casing and surrounding spaces', () => {
    const basketId = 'basket-3';
    const securedKey = 'secured';
    const merchantId = 'merchant';
    const errCode = '999';
    const hash = crypto
      .createHash('sha256')
      .update(`${basketId}|${securedKey}|${merchantId}|${errCode}`)
      .digest('hex')
      .toUpperCase();

    expect(verifySignature({
      basket_id: basketId,
      err_code: errCode,
      validation_hash: ` ${hash} `,
    }, securedKey, merchantId)).toBe(true);
  });
});
