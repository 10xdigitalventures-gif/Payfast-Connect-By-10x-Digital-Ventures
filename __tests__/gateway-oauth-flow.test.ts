import { query } from '../lib/db';
import { beginGatewayOAuth, checkGatewayOAuthCallback } from '../lib/gateway-oauth-flow';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
const database = query as jest.Mock;

function callback(state: string | null, nonce?: string) {
  return {
    nextUrl: { searchParams: new URLSearchParams(state ? { state } : {}) },
    cookies: { get: (name: string) => name === 'gateway_oauth_payfast' && nonce ? { value: nonce } : undefined },
  } as any;
}

describe('controlled gateway OAuth state and nonce', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-long-enough-for-oauth-state-checks-123456';
    database.mockReset();
  });
  it('creates a database-backed one-time nonce', async () => {
    database.mockResolvedValue({ affectedRows: 1 });
    const { state, nonce } = await beginGatewayOAuth('payfast');
    expect(state).toContain('.payfast.');
    expect(nonce.length).toBeGreaterThan(32);
    expect(database).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO gateway_oauth_nonces'),
      [expect.stringMatching(/^[a-f0-9]{64}$/), 'payfast'],
    );
  });
  it('atomically consumes an authentic browser-bound state only once', async () => {
    database.mockResolvedValueOnce({ affectedRows: 1 }).mockResolvedValueOnce({ affectedRows: 1 }).mockResolvedValueOnce({ affectedRows: 0 });
    const { state, nonce } = await beginGatewayOAuth('payfast');
    expect(await checkGatewayOAuthCallback(callback(state, nonce), 'payfast')).toEqual({ ok: true, controlled: true });
    expect(await checkGatewayOAuthCallback(callback(state, nonce), 'payfast')).toEqual({ ok: false, controlled: true });
  });
  it('rejects missing state when a controlled-install cookie exists', async () => {
    expect(await checkGatewayOAuthCallback(callback(null, 'browser-nonce'), 'payfast')).toEqual({ ok: false, controlled: true });
    expect(database).not.toHaveBeenCalled();
  });
  it('rejects a signed state without its matching browser cookie', async () => {
    database.mockResolvedValue({ affectedRows: 1 });
    const { state } = await beginGatewayOAuth('payfast');
    database.mockClear();
    expect(await checkGatewayOAuthCallback(callback(state), 'payfast')).toEqual({ ok: false, controlled: true });
    expect(database).not.toHaveBeenCalled();
  });
  it('rejects use of payfast state on a different provider', async () => {
    database.mockResolvedValue({ affectedRows: 1 });
    const { state, nonce } = await beginGatewayOAuth('payfast');
    expect(await checkGatewayOAuthCallback(callback(state, nonce), 'whop')).toEqual({ ok: false, controlled: true });
  });
  it('labels the code-only native Marketplace fallback separately', async () => {
    expect(await checkGatewayOAuthCallback(callback(null), 'payfast')).toEqual({ ok: true, controlled: false });
    expect(database).not.toHaveBeenCalled();
  });
});
