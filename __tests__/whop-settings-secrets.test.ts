import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/apps/whop/config/route';
import { query } from '../lib/db';
import { authorizeGatewayLocation } from '../lib/gateway-settings-auth';
import { provisionWhopProvider } from '../lib/whop-ghl-provider';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
jest.mock('../lib/gateway-settings-auth', () => ({ authorizeGatewayLocation: jest.fn() }));
jest.mock('../lib/whop-ghl-provider', () => ({ provisionWhopProvider: jest.fn() }));
const db = query as jest.Mock;
const access = authorizeGatewayLocation as jest.Mock;
const provision = provisionWhopProvider as jest.Mock;

const locationId = 'loc-123';
const url = 'https://gateway.example.test/api/apps/whop/config?locationId=' + locationId;
function post(body: object) {
  return new NextRequest(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId, ...body }),
  });
}

describe('Whop gateway credentials are write-only', () => {
  beforeEach(() => {
    db.mockReset();
    access.mockReset().mockResolvedValue({ok: true, locationId});
    provision.mockReset().mockResolvedValue({ok: true});
  });

  it('never reads or echoes plaintext secrets in settings GET', async () => {
    db.mockResolvedValueOnce([{
      whop_company_id: 'biz-saved', whop_rate_mode: 'fixed',
      whop_exchange_rate: 280, whop_fee_percent: 10,
      whop_currency: 'PKR', has_whop_api_key: 1, has_whop_webhook_secret: 1,
      oauth_connected: 1,
    }]);
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.whop_api_key).toBe('');
    expect(body.whop_webhook_secret).toBe('');
    expect(body.has_whop_api_key).toBe(true);
    expect(body.has_whop_webhook_secret).toBe(true);
    expect(JSON.stringify(body)).not.toContain('sk_live');
    const sql = String(db.mock.calls[0][0]);
    expect(sql).not.toMatch(/SELECT\s+whop_api_key\b/i);
  });

  it('retains existing API and webhook secrets when password inputs are blank', async () => {
    db.mockResolvedValueOnce([{
      access_token:'ghl-token', whop_api_key:'sk_saved', whop_webhook_secret:'whsec_saved',
    }]).mockResolvedValueOnce({ affectedRows: 1 });
    const response = await POST(post({
      whop_api_key: '', whop_webhook_secret: '', whop_company_id: 'biz-saved',
      whop_rate_mode: 'fixed', whop_exchange_rate: 280,
      whop_fee_percent: 10, whop_currency: 'PKR',
    }));
    expect(response.status).toBe(200);
    const updated = db.mock.calls[1][1] as unknown[];
    expect(updated[0]).toBe('sk_saved');
    expect(updated[1]).toBe('biz-saved');
    expect(updated[2]).toBe('whsec_saved');
    expect(provision).toHaveBeenCalledWith(locationId);
  });

  it('rotates only secrets explicitly submitted by the administrator', async () => {
    db.mockResolvedValueOnce([{
      access_token:'ghl-token', whop_api_key:'sk_saved', whop_webhook_secret:'whsec_saved',
    }]).mockResolvedValueOnce({ affectedRows: 1 });
    await POST(post({
      whop_api_key: 'sk_new', whop_webhook_secret: 'whsec_new',
      whop_company_id: 'biz-saved', whop_rate_mode: 'fixed',
    }));
    expect(db.mock.calls[1][1][0]).toBe('sk_new');
    expect(db.mock.calls[1][1][2]).toBe('whsec_new');
  });

  it('does not fetch credentials when the location is unauthorized', async () => {
    access.mockResolvedValueOnce({
      ok: false, response: new Response('Forbidden', { status: 403 }),
    });
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(403);
    expect(db).not.toHaveBeenCalled();
  });
});
