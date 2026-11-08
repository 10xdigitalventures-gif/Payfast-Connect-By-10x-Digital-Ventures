import { createHash, randomBytes } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createGatewayOAuthState, verifyGatewayOAuthState, type GatewayOAuthProvider } from '@/lib/gateway-oauth-state';

const PROVIDERS: GatewayOAuthProvider[] = ['payfast', 'whop', 'swich'];
const COOKIE_PREFIX = 'gateway_oauth_';
const TEN_MINUTES = 600;

function secret(): string {
  const value = process.env.SESSION_SECRET || '';
  if (value.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return value;
}

function cookieName(provider: GatewayOAuthProvider): string {
  return COOKIE_PREFIX + provider;
}

function digest(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex');
}

/** The standalone flows initiated on our domain bind a signed state to an
 * HttpOnly same-site nonce cookie and a one-time database record. Native
 * Marketplace installation links may omit state; that path remains distinct. */
export async function beginGatewayOAuth(provider: GatewayOAuthProvider): Promise<{ state: string; nonce: string }> {
  if (!PROVIDERS.includes(provider)) throw new Error('Unknown provider');
  const nonce = randomBytes(32).toString('base64url');
  const state = createGatewayOAuthState(provider, secret(), nonce);
  await query(
    'INSERT INTO gateway_oauth_nonces (nonce_sha256, provider, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
    [digest(nonce), provider],
  );
  return { state, nonce };
}

export function setGatewayOAuthCookie(response: NextResponse, provider: GatewayOAuthProvider, nonce: string): void {
  response.cookies.set(cookieName(provider), nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TEN_MINUTES,
    path: `/oauth/${provider}/callback`,
  });
}

export function clearGatewayOAuthCookie(response: NextResponse, provider: GatewayOAuthProvider): void {
  response.cookies.set(cookieName(provider), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: `/oauth/${provider}/callback`,
  });
}

/**
 * For our initiated flow, always demand signed matching state and consume
 * the nonce atomically. Never allow a missing state to bypass a pending cookie.
 * HighLevel native marketplace installs without state are a separate legacy
 * compatibility path until their state forwarding contract is confirmed.
 */
export async function checkGatewayOAuthCallback(
  request: NextRequest,
  provider: GatewayOAuthProvider,
): Promise<{ ok: boolean; controlled: boolean }> {
  const state = request.nextUrl.searchParams.get('state');
  const nonce = request.cookies.get(cookieName(provider))?.value;
  if (!state && !nonce) return { ok: true, controlled: false };
  if (!verifyGatewayOAuthState(state, provider, secret(), nonce)) return { ok: false, controlled: true };
  const result = await query<any>(
    `UPDATE gateway_oauth_nonces SET consumed_at=NOW()
      WHERE nonce_sha256=? AND provider=? AND consumed_at IS NULL AND expires_at > NOW()`,
    [digest(nonce!), provider],
  );
  return { ok: result?.affectedRows === 1, controlled: true };
}
