import { NextRequest } from 'next/server';
import { GET } from '../app/api/apps/whop/status/route';
import { query } from '../lib/db';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
const db = query as jest.Mock;
const base = 'https://gateway.example.test/api/apps/whop/status';
const params = 'locationId=location-A&basketId=WHOP-SETUP-abcdef123456&payToken=abcdef1234567890abcdef1234567890';

describe('standalone Whop payment status', () => {
  beforeEach(() => db.mockReset());

  it('rejects status reads without the random receipt token', async () => {
    const response = await GET(new NextRequest(base + '?locationId=location-A&basketId=WHOP-123'));
    expect(response.status).toBe(400);
    expect(db).not.toHaveBeenCalled();
  });

  it('scopes query to Whop, the precise tenant, basket and random token', async () => {
    db.mockResolvedValueOnce([{ status: 'complete', pf_payment_id: 'whop-payment-1' }]);
    const response = await GET(new NextRequest(base + '?' + params));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'paid', chargeId: 'whop-payment-1' });
    expect(String(db.mock.calls[0][0])).toContain("provider='whop'");
    expect(db.mock.calls[0][1]).toEqual([
      'location-A', 'WHOP-SETUP-abcdef123456', 'abcdef1234567890abcdef1234567890',
    ]);
  });

  it('does not leak payment status to mismatched tokens', async () => {
    db.mockResolvedValueOnce([]);
    expect((await GET(new NextRequest(base + '?' + params))).status).toBe(404);
  });

  it('never reports pending or failed status as paid', async () => {
    db.mockResolvedValueOnce([{ status: 'pending', pf_payment_id: null }]);
    expect((await (await GET(new NextRequest(base + '?' + params))).json()).status).toBe('pending');
    db.mockResolvedValueOnce([{ status: 'failed', pf_payment_id: null }]);
    expect((await (await GET(new NextRequest(base + '?' + params))).json()).status).toBe('failed');
  });
});
