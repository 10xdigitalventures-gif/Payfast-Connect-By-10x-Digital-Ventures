import { query } from '../lib/db';
import { getValidPayfastToken } from '../lib/payfast-ghl-token';
import { getValidWhopGhlToken } from '../lib/whop-ghl-token';
import { getValidSwichGhlToken } from '../lib/swich-ghl-token';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
const dbQuery = query as jest.Mock;
const originalFetch = global.fetch;

const gateways = [
  { name: 'payfast', prefix: 'PAYFAST_GHL', refresh: getValidPayfastToken },
  { name: 'whop', prefix: 'WHOP_GHL', refresh: getValidWhopGhlToken },
  { name: 'swich', prefix: 'SWICH_GHL', refresh: getValidSwichGhlToken },
];

describe('GHL v3 standalone refresh contract', () => {
  beforeEach(() => dbQuery.mockReset());
  afterAll(() => { global.fetch = originalFetch; });

  for (const gateway of gateways) {
    it(`${gateway.name} requests Version: v3 and rotates saved tokens`, async () => {
      const clientIdVar = `${gateway.prefix}_CLIENT_ID`;
      const clientSecretVar = `${gateway.prefix}_CLIENT_SECRET`;
      const oldId = process.env[clientIdVar];
      const oldSecret = process.env[clientSecretVar];
      process.env[clientIdVar] = 'test-client';
      process.env[clientSecretVar] = 'test-secret';
      try {
        dbQuery.mockResolvedValueOnce([{
          access_token: 'old-access', refresh_token: 'old-refresh',
          expires_at: new Date(Date.now() - 60_000),
        }]).mockResolvedValueOnce({ affectedRows: 1 });
        const fetchMock = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600,
          }),
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        const accessToken = await gateway.refresh('loc-123');
        expect(accessToken).toBe('new-access');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [tokenUrl, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(tokenUrl).toBe('https://services.leadconnectorhq.com/oauth/token');
        expect(options.headers).toEqual(expect.objectContaining({ Version: 'v3' }));
        const form = options.body as URLSearchParams;
        expect(form.get('grant_type')).toBe('refresh_token');
        expect(form.get('refresh_token')).toBe('old-refresh');
        expect(dbQuery).toHaveBeenCalledTimes(2);
        const updateParams = dbQuery.mock.calls[1][1] as unknown[];
        expect(updateParams).toContain('new-refresh');
      } finally {
        if (oldId === undefined) delete process.env[clientIdVar];
        else process.env[clientIdVar] = oldId;
        if (oldSecret === undefined) delete process.env[clientSecretVar];
        else process.env[clientSecretVar] = oldSecret;
        dbQuery.mockReset();
      }
    });
  }
});
