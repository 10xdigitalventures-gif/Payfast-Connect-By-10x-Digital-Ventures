import { authorizeGatewayLocation } from '../lib/gateway-settings-auth';
import { getSession } from '../lib/session';

jest.mock('../lib/session', () => ({ getSession: jest.fn() }));
const mockedSession = getSession as jest.Mock;

describe('gateway settings authorization', () => {
  beforeEach(() => mockedSession.mockReset());

  it('rejects missing and malformed location IDs before session lookup', async () => {
    for (const value of [null, '', '../other', '{locationId}', 'a b']) {
      const result = await authorizeGatewayLocation('payfast', value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(400);
    }
    expect(mockedSession).not.toHaveBeenCalled();
  });

  it('rejects anonymous requests', async () => {
    mockedSession.mockResolvedValue(null);
    const result = await authorizeGatewayLocation('whop', 'location-123');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('rejects cross-location access', async () => {
    mockedSession.mockResolvedValue({ role: 'user', installMode: 'subaccount', locationId: 'location-A' });
    const result = await authorizeGatewayLocation('swich', 'location-B');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('does not treat an agency session as unrestricted location membership', async () => {
    mockedSession.mockResolvedValue({ role: 'agency', installMode: 'agency', locationId: 'location-A' });
    const result = await authorizeGatewayLocation('payfast', 'location-A');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('allows the authenticated matching subaccount location', async () => {
    mockedSession.mockResolvedValue({ role: 'user', installMode: 'subaccount', locationId: 'location-A' });
    for (const provider of ['payfast', 'whop', 'swich'] as const) {
      expect(await authorizeGatewayLocation(provider, 'location-A')).toEqual({ ok: true, locationId: 'location-A' });
    }
  });
});
