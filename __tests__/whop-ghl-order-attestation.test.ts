import { attestWhopGhlOrder } from '../lib/ghl-whop-order-attestation';
import { getValidWhopGhlToken } from '../lib/whop-ghl-token';

jest.mock('../lib/whop-ghl-token', () => ({ getValidWhopGhlToken: jest.fn() }));
const token = getValidWhopGhlToken as jest.Mock;
const originalFetch = global.fetch;
const input = { locationId: 'loc-A', orderId: 'order-A', amount: 100, currency: 'USD', contactId: 'contact-A' };
const order = {
  _id: 'order-A', altId: 'loc-A', amount: 100, currency: 'USD',
  contactId: 'contact-A', paymentStatus: 'unpaid',
};

describe('standalone Whop order attestation over GHL API v3', () => {
  let fetched: jest.Mock;
  beforeEach(() => {
    token.mockReset().mockResolvedValue('ghl-access-token');
    fetched = jest.fn().mockResolvedValue({ ok: true, json: async () => order });
    global.fetch = fetched as unknown as typeof fetch;
  });
  afterAll(() => { global.fetch = originalFetch; });

  it('matches a GHL-authenticated order before creating a Whop checkout', async () => {
    expect(await attestWhopGhlOrder(input)).toEqual({ ok: true });
    const [url, options] = fetched.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/payments/orders/order-A?');
    expect(url).toContain('altId=loc-A');
    expect(options.headers).toEqual(expect.objectContaining({
      Authorization: 'Bearer ghl-access-token', Version: 'v3',
    }));
  });

  it('fails closed for absent order ID or unavailable access token', async () => {
    expect((await attestWhopGhlOrder({ ...input, orderId: '' })).ok).toBe(false);
    expect(fetched).not.toHaveBeenCalled();
    token.mockResolvedValueOnce(null);
    expect((await attestWhopGhlOrder(input)).ok).toBe(false);
  });

  it.each([
    [{ ...order, amount: 1 }, 'altered amount'],
    [{ ...order, currency: 'PKR' }, 'currency mismatch'],
    [{ ...order, altId: 'another-tenant' }, 'cross-tenant order'],
    [{ ...order, contactId: 'another-contact' }, 'cross-contact order'],
    [{ ...order, paymentStatus: 'paid' }, 'already-paid order'],
    [{ ...order, _id: 'different-order' }, 'incorrect order ID'],
  ])('rejects %s (%s)', async (item) => {
    fetched.mockResolvedValueOnce({ ok: true, json: async () => item });
    const result = await attestWhopGhlOrder(input);
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 409 }));
  });

  it('does not charge when GHL order lookup fails', async () => {
    fetched.mockResolvedValueOnce({ ok: false, status: 429 });
    expect((await attestWhopGhlOrder(input)).ok).toBe(false);
    expect(fetched).toHaveBeenCalledTimes(1);
  });
});
