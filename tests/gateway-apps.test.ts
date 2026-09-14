import { isolateProviderAvailability, normalizeGatewayApp } from '../lib/gateway-apps';

describe('standalone gateway app isolation', () => {
  test('normalizes only known gateway app names', () => {
    expect(normalizeGatewayApp('payfast')).toBe('payfast');
    expect(normalizeGatewayApp('whop')).toBe('whop');
    expect(normalizeGatewayApp('swich')).toBe('swich');
    expect(normalizeGatewayApp('unknown')).toBe('combined');
  });

  test('PayFast app never exposes another provider', () => {
    expect(isolateProviderAvailability('payfast', { payfast: true, whop: true, swich: true })).toEqual({
      payfast: true,
      whop: false,
      swich: false,
      routing: { oneoff: 'payfast', subscription: 'payfast' },
    });
  });

  test('PayFast remains unavailable when its own credentials are missing', () => {
    expect(isolateProviderAvailability('payfast', { payfast: false, whop: true })?.payfast).toBe(false);
  });
});
