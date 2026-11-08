import { GET } from '../app/auth/launch/route';
import { getSession } from '../lib/session';

jest.mock('../lib/session', () => ({ getSession: jest.fn() }));
jest.mock('../lib/app-url', () => ({
  getAppUrlWithSearch: (path: string) => new URL(path, 'https://example.test'),
}));
const session = getSession as jest.Mock;

function request(search: string): any {
  return { nextUrl: { searchParams: new URLSearchParams(search) } };
}

describe('legacy launch authorization', () => {
  beforeEach(() => session.mockReset());

  it('does not create a session for a forged locationId', async () => {
    session.mockResolvedValue(null);
    const result = await GET(request('locationId=victim'));
    expect(result.status).toBe(307);
    expect(result.headers.get('location')).toBe('https://example.test/login');
    expect(result.headers.get('set-cookie')).toBeNull();
  });

  it('rejects a different location even with an existing session', async () => {
    session.mockResolvedValue({ role: 'user', installMode: 'subaccount', locationId: 'mine' });
    const result = await GET(request('locationId=victim'));
    expect(result.status).toBe(403);
  });

  it('rejects company-only launch without verified membership', async () => {
    session.mockResolvedValue({ role: 'user', installMode: 'subaccount', locationId: 'mine' });
    const result = await GET(request('companyId=some-company'));
    expect(result.status).toBe(403);
  });

  it('rejects agency mode from subaccount session', async () => {
    session.mockResolvedValue({ role: 'user', installMode: 'subaccount', locationId: 'mine' });
    const result = await GET(request('mode=agency&locationId=mine'));
    expect(result.status).toBe(403);
  });

  it('routes a matching authenticated subaccount without minting a new session', async () => {
    session.mockResolvedValue({ role: 'user', installMode: 'subaccount', locationId: 'mine' });
    const result = await GET(request('locationId=mine'));
    expect(result.status).toBe(307);
    expect(result.headers.get('location')).toBe('https://example.test/dashboard');
    expect(result.headers.get('set-cookie')).toBeNull();
  });
});
