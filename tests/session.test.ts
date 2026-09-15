import { createSessionToken, verifySessionToken } from '../lib/session';

describe('signed sessions', () => {
  const original = process.env.SESSION_SECRET;
  beforeAll(() => { process.env.SESSION_SECRET = 'test_session_secret_at_least_32_characters'; });
  afterAll(() => {
    if (original === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = original;
  });

  test('round-trips a scoped user session', async () => {
    const token = await createSessionToken({ userId: 7, username: 'merchant', role: 'user', locationId: 'loc-123' });
    await expect(verifySessionToken(token)).resolves.toMatchObject({ role: 'user', locationId: 'loc-123', installMode: 'subaccount' });
  });

  test('rejects a modified token', async () => {
    const token = await createSessionToken({ role: 'agency', locationId: 'agency-loc' });
    const parts = token.split('.');
    parts[2] = `${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;
    await expect(verifySessionToken(parts.join('.'))).resolves.toBeNull();
  });
});
