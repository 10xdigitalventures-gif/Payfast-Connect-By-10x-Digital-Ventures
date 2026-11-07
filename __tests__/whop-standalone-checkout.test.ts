import { NextRequest } from 'next/server';
import { POST as pay } from '../app/api/apps/whop/pay/route';
import { POST as setup } from '../app/api/apps/whop/setup/route';
import { query } from '../lib/db';
import { attestWhopGhlOrder } from '../lib/ghl-whop-order-attestation';
import { createWhopCheckout, createWhopSetupCheckout } from '../lib/whop';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
jest.mock('../lib/ghl-whop-order-attestation', () => ({ attestWhopGhlOrder: jest.fn() }));
jest.mock('../lib/whop', () => ({
  convertPkrToUsd: jest.fn(() => 100),
  calculateFeePkr: jest.fn(() => 0),
  resolveExchangeRate: jest.fn(async () => ({ rate: 280, source: 'fixed' })),
  billingPeriodDaysForFrequency: jest.fn(() => 30),
  createWhopCheckout: jest.fn(),
  createWhopSetupCheckout: jest.fn(),
}));
const db = query as jest.Mock;
const verify = attestWhopGhlOrder as jest.Mock;
const checkout = createWhopCheckout as jest.Mock;
const cardSetup = createWhopSetupCheckout as jest.Mock;

function request(path: string, body: object) {
  return new NextRequest('https://gateway.example.test' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const payBody = {
  locationId: 'loc-A', publishableKey: 'pk-whop-A', amount: 100, currency: 'USD',
  email: 'customer@example.test', contactId: 'contact-A', orderId: 'order-A',
  ghlTransactionId: 'ghl-txn-A', description: 'Test order',
};
const setupBody = {
  locationId: 'loc-A', publishableKey: 'pk-whop-A', contactId: 'contact-A',
  email: 'customer@example.test', name: 'Customer',
};

describe('standalone Whop checkout initiation', () => {
  const oldUrl = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://gateway.example.test';
    db.mockReset().mockImplementation(async (sql: string) => sql.trim().startsWith('SELECT')
      ? [{ whop_api_key: 'sk-whop', whop_company_id: 'company-A',
        provider_publishable_key: 'pk-whop-A', whop_currency: 'USD' }]
      : { affectedRows: 1 });
    verify.mockReset().mockResolvedValue({ ok: true });
    checkout.mockReset().mockResolvedValue({
      ok: true, checkoutUrl: 'https://whop.com/checkout/example', checkoutId: 'checkout-A',
    });
    cardSetup.mockReset().mockResolvedValue({
      ok: true, checkoutUrl: 'https://whop.com/checkout/setup', checkoutId: 'setup-A',
    });
  });
  afterAll(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = oldUrl;
  });

  it('rejects mismatched provider publishable key before creating a hosted checkout', async () => {
    expect((await pay(request('/api/apps/whop/pay', { ...payBody, publishableKey: 'pk-other' }))).status).toBe(403);
    expect(verify).not.toHaveBeenCalled();
    expect(checkout).not.toHaveBeenCalled();
  });

  it('fails closed when GHL v3 order attestation fails', async () => {
    verify.mockResolvedValueOnce({ ok: false, status: 409, error: 'GHL order mismatch' });
    const response = await pay(request('/api/apps/whop/pay', payBody));
    expect(response.status).toBe(409);
    expect(checkout).not.toHaveBeenCalled();
    expect(db).toHaveBeenCalledTimes(1);
  });

  it('rejects missing order identifiers via attestation before charging', async () => {
    verify.mockResolvedValueOnce({ ok: false, status: 422, error: 'GHL order ID required' });
    const response = await pay(request('/api/apps/whop/pay', { ...payBody, orderId: '' }));
    expect(response.status).toBe(422);
    expect(checkout).not.toHaveBeenCalled();
  });

  it('creates isolated Whop hosted checkout for a verified GHL order', async () => {
    const response = await pay(request('/api/apps/whop/pay', payBody));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.provider).toBe('whop');
    expect(result.redirectUrl).toContain('https://whop.com/');
    expect(result.payToken).toMatch(/^[a-f0-9]{32}$/);
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(checkout.mock.calls[0][0].metadata.app).toBe('whop');
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ amount: 100, currency: 'USD', orderId: 'order-A' }));
  });

  it('binds setup to Whop public key and returns an unguessable status token', async () => {
    const bad = await setup(request('/api/apps/whop/setup', { ...setupBody, publishableKey: 'wrong' }));
    expect(bad.status).toBe(403);
    expect(cardSetup).not.toHaveBeenCalled();
    const good = await setup(request('/api/apps/whop/setup', setupBody));
    expect(good.status).toBe(200);
    expect((await good.json()).payToken).toMatch(/^[a-f0-9]{32}$/);
    expect(cardSetup).toHaveBeenCalledTimes(1);
  });
});
