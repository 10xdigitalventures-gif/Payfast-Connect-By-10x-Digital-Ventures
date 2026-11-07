import { getPaymentPopupTargetOrigin } from '../lib/payment-popup-origin';

describe('payment popup target origin', () => {
  it('accepts a configured HTTPS app origin, not the callback parameters', () => {
    expect(getPaymentPopupTargetOrigin('https://payfast.example.test/apps/payfast/checkout?locationId=other'))
      .toBe('https://payfast.example.test');
  });

  it('accepts HTTP only for local development', () => {
    expect(getPaymentPopupTargetOrigin('http://localhost:3000/checkout')).toBe('http://localhost:3000');
    expect(getPaymentPopupTargetOrigin('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
    expect(getPaymentPopupTargetOrigin('http://payfast.example.test')).toBeNull();
  });

  it('fails closed for unconfigured, unsafe or invalid origins', () => {
    for (const input of ['', '//evil.example', 'javascript:alert(1)',
      'https://user:password@payfast.example.test', 'not a URL']) {
      expect(getPaymentPopupTargetOrigin(input)).toBeNull();
    }
  });

  it('does not use a callback host when NEXT_PUBLIC_APP_URL is missing', () => {
    const current = process.env.NEXT_PUBLIC_APP_URL;
    try {
      delete process.env.NEXT_PUBLIC_APP_URL;
      expect(getPaymentPopupTargetOrigin()).toBeNull();
    } finally {
      if (current === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = current;
    }
  });
});
