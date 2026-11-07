import { createCipheriv, createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { decryptMarketplaceUserContext } from '../lib/marketplace-sso';
import { createGatewaySettingsToken, verifyGatewaySettingsToken } from '../lib/gateway-marketplace-token';
import { POST } from '../app/api/marketplace/session/route';
import { query } from '../lib/db';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
const db = query as jest.Mock;
const secret = 'marketplace-shared-secret-for-payfast-test-123';
const otherSecret = 'different-whop-secret-must-not-authorize-payfast';

function encryptedContext(context: Record<string, unknown>, passphrase = secret) {
  // CryptoJS passphrase AES default OpenSSL Salted__ formatter / EVP_BytesToKey
  const salt = Buffer.from('t3stSalt');
  let result = Buffer.alloc(0), prev = Buffer.alloc(0);
  const pass = Buffer.from(passphrase, 'utf8');
  while (result.length < 48) {
    prev = createHash('md5').update(Buffer.concat([prev, pass, salt])).digest();
    result = Buffer.concat([result, prev]);
  }
  const cipher = createCipheriv('aes-256-cbc', result.subarray(0, 32), result.subarray(32, 48));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(context)), cipher.final()]);
  return Buffer.concat([Buffer.from('Salted__'), salt, encrypted]).toString('base64');
}
const validContext = {
  userId: 'ghl-user-1', type: 'location', role: 'admin',
  companyId: 'company-A', activeLocation: 'location-A',
};

function ssoRequest(payload: Record<string, unknown>, origin = 'https://gateway.example.test') {
  return new NextRequest('https://gateway.example.test/api/marketplace/session', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('Marketplace signed-context session bootstrap', () => {
  const originalEnv = {
    APP: process.env.NEXT_PUBLIC_APP_URL, SESSION: process.env.SESSION_SECRET,
    PAYFAST: process.env.PAYFAST_GHL_SHARED_SECRET, WHOP: process.env.WHOP_GHL_SHARED_SECRET,
  };
  beforeEach(() => {
    db.mockReset().mockResolvedValue([{ access_token: 'installed', company_id: 'company-A' }]);
    process.env.NEXT_PUBLIC_APP_URL = 'https://gateway.example.test';
    process.env.SESSION_SECRET = 'session-signing-secret-with-32-plus-characters';
    process.env.PAYFAST_GHL_SHARED_SECRET = secret;
    process.env.WHOP_GHL_SHARED_SECRET = otherSecret;
  });
  afterAll(() => {
    const map: Record<string, string | undefined> = {
      NEXT_PUBLIC_APP_URL: originalEnv.APP, SESSION_SECRET: originalEnv.SESSION,
      PAYFAST_GHL_SHARED_SECRET: originalEnv.PAYFAST, WHOP_GHL_SHARED_SECRET: originalEnv.WHOP,
    };
    for (const [key, value] of Object.entries(map)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  it('decrypts the documented CryptoJS-format payload', () => {
    expect(decryptMarketplaceUserContext(encryptedContext(validContext), secret))
      .toEqual(expect.objectContaining({ userId: 'ghl-user-1', activeLocation: 'location-A' }));
  });

  it('issues a token bound to provider and location', async () => {
    const response = await POST(ssoRequest({
      provider: 'payfast', locationId: 'location-A', encryptedData: encryptedContext(validContext),
    }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(await verifyGatewaySettingsToken(data.token, 'payfast', 'location-A')).toBe(true);
    expect(await verifyGatewaySettingsToken(data.token, 'whop', 'location-A')).toBe(false);
    expect(await verifyGatewaySettingsToken(data.token, 'payfast', 'location-B')).toBe(false);
  });

  it('rejects mismatched location, provider secret, origin, and company', async () => {
    const payload = { provider: 'payfast', locationId: 'location-B', encryptedData: encryptedContext(validContext) };
    expect((await POST(ssoRequest(payload))).status).toBe(403);
    expect((await POST(ssoRequest({ ...payload, locationId: 'location-A', provider: 'whop' }))).status).toBe(401);
    expect((await POST(ssoRequest({ ...payload, locationId: 'location-A' }, 'https://evil.example'))).status).toBe(403);
    db.mockResolvedValueOnce([{ access_token: 'installed', company_id: 'company-B' }]);
    expect((await POST(ssoRequest({ ...payload, locationId: 'location-A' }))).status).toBe(403);
  });

  it('rejects anonymous or agency-only encrypted context and absent installation', async () => {
    const payload = { provider: 'payfast', locationId: 'location-A' };
    expect((await POST(ssoRequest({ ...payload, encryptedData: encryptedContext({ companyId: 'company-A' }) }))).status).toBe(401);
    db.mockResolvedValueOnce([]);
    expect((await POST(ssoRequest({ ...payload, encryptedData: encryptedContext(validContext) }))).status).toBe(403);
  });
});
