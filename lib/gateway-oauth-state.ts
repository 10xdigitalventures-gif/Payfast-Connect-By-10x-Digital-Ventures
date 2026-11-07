import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type GatewayOAuthProvider = 'payfast' | 'whop' | 'swich';

const MAX_AGE_SECONDS = 10 * 60;
const STATE_VERSION = 'v1';

/**
 * Signed, short-lived OAuth state. The initiating session must also persist
 * the random nonce and consume it exactly once at callback time.
 * Signature verification alone does NOT prevent replay.
 */
export function createGatewayOAuthState(
  provider: GatewayOAuthProvider,
  secret: string,
  nonce = randomBytes(32).toString('base64url'),
  issuedAt = Math.floor(Date.now() / 1000),
): string {
  if (secret.length < 32) throw new Error('OAuth state secret must be at least 32 characters');
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(nonce)) throw new Error('Invalid OAuth nonce');
  const body = [STATE_VERSION, provider, issuedAt, nonce].join('.');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + signature;
}

export function verifyGatewayOAuthState(
  state: string | null | undefined,
  provider: GatewayOAuthProvider,
  secret: string,
  expectedNonce: string | null | undefined,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!state || !expectedNonce || secret.length < 32 || state.length > 512) return false;
  const parts = state.split('.');
  if (parts.length !== 5) return false;
  const [version, stateProvider, timestamp, nonce, signature] = parts;
  if (version !== STATE_VERSION || stateProvider !== provider) return false;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(nonce) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  if (!/^\d{10}$/.test(timestamp)) return false;
  const issuedAt = Number(timestamp);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 30 || now - issuedAt > MAX_AGE_SECONDS) return false;
  const nonceBuffer = Buffer.from(nonce);
  const expectedBuffer = Buffer.from(expectedNonce);
  if (nonceBuffer.length !== expectedBuffer.length || !timingSafeEqual(nonceBuffer, expectedBuffer)) return false;
  const body = parts.slice(0, 4).join('.');
  const actual = Buffer.from(signature, 'base64url');
  const expected = createHmac('sha256', secret).update(body).digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
