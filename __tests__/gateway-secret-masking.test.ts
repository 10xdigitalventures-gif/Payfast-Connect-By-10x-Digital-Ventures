import { NextRequest } from 'next/server';
import { GET as payfastGet, POST as payfastPost } from '../app/api/apps/payfast/config/route';
import { GET as swichGet, POST as swichPost } from '../app/api/apps/swich/config/route';
import { query } from '../lib/db';
import { authorizeGatewayLocation } from '../lib/gateway-settings-auth';
import { provisionPayfastProvider } from '../lib/payfast-ghl-provider';
import { provisionSwichProvider } from '../lib/swich-ghl-provider';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
jest.mock('../lib/gateway-settings-auth', () => ({ authorizeGatewayLocation: jest.fn() }));
jest.mock('../lib/payfast-ghl-provider', () => ({ provisionPayfastProvider: jest.fn() }));
jest.mock('../lib/swich-ghl-provider', () => ({ provisionSwichProvider: jest.fn() }));
const db = query as jest.Mock;
const authorized = authorizeGatewayLocation as jest.Mock;
const payfastProvision = provisionPayfastProvider as jest.Mock;
const swichProvision = provisionSwichProvider as jest.Mock;

function get(provider: string) {
  return new NextRequest(`https://app.example.test/api/apps/${provider}/config?locationId=loc-A`);
}
function post(provider: string, data: object) {
  return new NextRequest(`https://app.example.test/api/apps/${provider}/config`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId: 'loc-A', ...data }),
  });
}

describe('standalone gateway secret masking and rotation', () => {
  beforeEach(() => {
    db.mockReset();
    authorized.mockReset().mockResolvedValue({ ok: true, locationId: 'loc-A' });
    payfastProvision.mockReset().mockResolvedValue({ ok: true });
    swichProvision.mockReset().mockResolvedValue({ ok: true });
  });

  it('PayFast GET displays only saved secret flags, never merchant credentials', async () => {
    db.mockResolvedValueOnce([{
      merchant_id: 'merchant-A', merchant_name: 'Test',
      store_id: 'store-A', environment: 'sandbox', oauth_connected: 1,
      has_merchant_key: 1, has_passphrase: 1,
    }]);
    const response = await payfastGet(get('payfast'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.merchant_key).toBe('');
    expect(data.passphrase).toBe('');
    expect(data.has_merchant_key).toBe(true);
    expect(data.has_passphrase).toBe(true);
    expect(String(db.mock.calls[0][0])).not.toContain('merchant_key, passphrase');
  });

  it('PayFast retains saved merchant key and passphrase on blank settings POST', async () => {
    db.mockResolvedValueOnce([{
      id: 1, access_token: 'ghl', merchant_key: 'saved-merchant-key', passphrase: 'saved-passphrase',
    }]).mockResolvedValueOnce({ affectedRows: 1 });
    const response = await payfastPost(post('payfast', {
      merchant_id: 'merchant-A', merchant_name: 'Test',
      merchant_key: '', passphrase: '', environment: 'sandbox',
    }));
    expect(response.status).toBe(200);
    const values = db.mock.calls[1][1] as unknown[];
    expect(values[3]).toBe('saved-merchant-key');
    expect(values[4]).toBe('saved-passphrase');
    expect(payfastProvision).toHaveBeenCalledTimes(1);
  });

  it('SWICH GET hides live and sandbox secrets', async () => {
    db.mockResolvedValueOnce([{
      environment: 'sandbox', live_client_id: 'live-client',
      sandbox_client_id: 'sandbox-client',
      has_live_secret_key: 1, has_sandbox_secret_key: 1,
      live_checkout_url: 'https://example.test/live',
      sandbox_checkout_url: 'https://example.test/sandbox',
    }]);
    const response = await swichGet(get('swich'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.live_secret_key).toBe('');
    expect(data.sandbox_secret_key).toBe('');
    expect(data.has_live_secret_key).toBe(1);
    expect(data.has_sandbox_secret_key).toBe(1);
  });

  it('SWICH retains both secrets when saving only the active environment', async () => {
    db.mockResolvedValueOnce([{
      access_token: 'ghl', live_secret_key: 'live-saved',
      sandbox_secret_key: 'sandbox-saved',
    }]).mockResolvedValueOnce({ affectedRows: 1 });
    const response = await swichPost(post('swich', {
      environment: 'sandbox', live_client_id: 'live-client',
      sandbox_client_id: 'sandbox-client',
      live_checkout_url: 'https://example.test/live',
      sandbox_checkout_url: 'https://example.test/sandbox',
      live_secret_key: '', sandbox_secret_key: '',
    }));
    expect(response.status).toBe(200);
    const values = db.mock.calls[1][1] as unknown[];
    expect(values[2]).toBe('live-saved');
    expect(values[5]).toBe('sandbox-saved');
    expect(swichProvision).toHaveBeenCalledWith('loc-A');
  });
});
