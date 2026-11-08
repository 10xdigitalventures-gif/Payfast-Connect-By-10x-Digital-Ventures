import { createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { MarketplaceProvider } from './marketplace-sso';

const ISSUER = '10x-ghl-marketplace';
const AUDIENCE = 'gateway-settings';
function key() {
  const sessionSecret = String(process.env.SESSION_SECRET || '');
  if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  // Different key domain from legacy pf_session JWT, preventing token confusion.
  return createHash('sha256').update('10x-ghl-marketplace-settings:v1:').update(sessionSecret).digest();
}
export async function createGatewaySettingsToken(
  provider: MarketplaceProvider, locationId: string, userId: string,
): Promise<string> {
  return new SignJWT({ provider, locationId, userId, purpose: 'gateway-settings' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key());
}
export async function verifyGatewaySettingsToken(
  token: string, provider: MarketplaceProvider, locationId: string,
): Promise<boolean> {
  if (!token || token.length > 4096) return false;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE,
    });
    return payload.purpose === 'gateway-settings' &&
      payload.provider === provider &&
      payload.locationId === locationId &&
      typeof payload.userId === 'string' && !!payload.userId;
  } catch {
    return false;
  }
}
