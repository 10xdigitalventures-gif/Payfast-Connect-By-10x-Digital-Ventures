import crypto from 'crypto';
import { buildSwichCheckoutForm, verifySwichCallback } from '../lib/swich';

describe('Swich checkout helpers', () => {
  test('builds a PKR hosted checkout with a signed request', () => {
    const result = buildSwichCheckoutForm({ clientId: ' client ', secretKey: 'secret', checkoutUrl: 'https://sandbox.example/checkout',
      customerTransactionId: 'customer-1', orderId: 'order-1', amount: 100, returnUrl: 'https://example.com/return', callbackUrl: 'https://example.com/callback' });
    expect(result.actionUrl).toBe('https://sandbox.example/checkout');
    expect(result.fields.clientId).toBe('client');
    expect(result.fields.amount).toBe('100.00');
    expect(result.fields.currency).toBe('PKR');
    expect(result.fields.checksum).toHaveLength(64);
  });

  test('verifies the documented Swich callback checksum', () => {
    const payload = { CustomerTransactionId: 'customer-1', OrderId: 'order-1', Amount: '100.00', Status: 'SUCCESS' };
    const checksum = crypto.createHmac('sha256', 'secret').update('SWCallback:customer-1:order-1:100.00:SUCCESS').digest('hex');
    expect(verifySwichCallback({ ...payload, checksum }, 'secret')).toBe(true);
    expect(verifySwichCallback({ ...payload, checksum: '0'.repeat(64) }, 'secret')).toBe(false);
  });
});
