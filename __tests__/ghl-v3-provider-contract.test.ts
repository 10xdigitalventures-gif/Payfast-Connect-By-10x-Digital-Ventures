import { query } from '../lib/db';
import { getValidPayfastToken } from '../lib/payfast-ghl-token';
import { getValidWhopGhlToken } from '../lib/whop-ghl-token';
import { getValidSwichGhlToken } from '../lib/swich-ghl-token';
import { provisionPayfastProvider } from '../lib/payfast-ghl-provider';
import { provisionWhopProvider } from '../lib/whop-ghl-provider';
import { provisionSwichProvider } from '../lib/swich-ghl-provider';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
jest.mock('../lib/payfast-ghl-token', () => ({ getValidPayfastToken: jest.fn() }));
jest.mock('../lib/whop-ghl-token', () => ({ getValidWhopGhlToken: jest.fn() }));
jest.mock('../lib/swich-ghl-token', () => ({ getValidSwichGhlToken: jest.fn() }));

describe('HighLevel custom provider v3 request contract', () => {
  const originalFetch = global.fetch;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const fetchMock = jest.fn();
  const cases = [
    { name: 'PayFast', token: getValidPayfastToken, provision: () => provisionPayfastProvider('loc-123', 'test'), subscriptions: true },
    { name: 'Whop', token: getValidWhopGhlToken, provision: () => provisionWhopProvider('loc-123'), subscriptions: true },
    { name: 'SWICH', token: getValidSwichGhlToken, provision: () => provisionSwichProvider('loc-123'), subscriptions: false },
  ];

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://gateway.example.test';
    fetchMock.mockReset().mockResolvedValue({
      ok: true, text: async () => JSON.stringify({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    (query as jest.Mock).mockReset().mockImplementation(async (sql: string) =>
      sql.trim().toUpperCase().startsWith('SELECT') ?
        [{ provider_api_key: 'sk-test', provider_publishable_key: 'pk-test' }] :
        { affectedRows: 1 });
    for (const item of cases) (item.token as jest.Mock).mockResolvedValue('ghl-token');
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  for (const testCase of cases) {
    it(`${testCase.name} sends documented v3 provider, config and capabilities payloads`, async () => {
      const result = await testCase.provision();
      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const calls = fetchMock.mock.calls as [string, RequestInit][];
      for (const [url, options] of calls) {
        expect(options.headers).toEqual(expect.objectContaining({ Version: 'v3' }));
        expect(url).toContain('services.leadconnectorhq.com/payments/custom-provider/');
      }

      const [createUrl, createOpts] = calls[0];
      expect(createUrl).toContain('/provider?locationId=loc-123');
      const provider = JSON.parse(String(createOpts.body));
      expect(provider.locationId).toBeUndefined();
      expect(provider.paymentsUrl).toContain('/apps/');
      expect(provider.queryUrl).toContain('/api/apps/');
      expect(provider.supportsSubscriptionSchedule).toBe(testCase.subscriptions);

      const [connectUrl, connectOpts] = calls[1];
      expect(connectUrl).toContain('/connect?locationId=loc-123');
      const connection = JSON.parse(String(connectOpts.body));
      expect(connection.live).toEqual({ apiKey: 'sk-test', publishableKey: 'pk-test' });
      expect(connection.test).toEqual({ apiKey: 'sk-test', publishableKey: 'pk-test' });
      expect(connection.liveMode).toBeUndefined();

      const [capabilityUrl, capabilityOpts] = calls[2];
      expect(capabilityUrl).toContain('/capabilities');
      const capability = JSON.parse(String(capabilityOpts.body));
      expect(capability.locationId).toBe('loc-123');
      expect(capability.supportsSubscriptionSchedules).toBe(testCase.subscriptions);
    });
  }
});
