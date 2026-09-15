import { getPayfastOAuthConfig } from '../lib/payfast-ghl-token';

describe('standalone PayFast OAuth configuration', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
  });

  afterAll(() => {
    process.env = original;
  });

  test('uses only the dedicated PayFast GHL app credentials', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://payments.example.com/';
    process.env.PAYFAST_GHL_CLIENT_ID = 'payfast-client';
    process.env.PAYFAST_GHL_CLIENT_SECRET = 'payfast-secret';
    process.env.GHL_CLIENT_ID = 'legacy-client';
    expect(getPayfastOAuthConfig()).toEqual({
      clientId: 'payfast-client',
      clientSecret: 'payfast-secret',
      redirectUri: 'https://payments.example.com/oauth/payfast/callback',
    });
  });

  test('does not fall back to the legacy combined app credentials', () => {
    delete process.env.PAYFAST_GHL_CLIENT_ID;
    delete process.env.PAYFAST_GHL_CLIENT_SECRET;
    process.env.GHL_CLIENT_ID = 'legacy-client';
    process.env.GHL_CLIENT_SECRET = 'legacy-secret';
    expect(getPayfastOAuthConfig().clientId).toBe('');
    expect(getPayfastOAuthConfig().clientSecret).toBe('');
  });
});
