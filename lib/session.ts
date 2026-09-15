import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { NextResponse } from 'next/server';

export type InstallMode = 'subaccount' | 'agency';
export const InstallMode = {
  SUBACCOUNT: 'subaccount' as InstallMode,
  AGENCY: 'agency' as InstallMode,
};

export type Session = {
  userId?: string | number;
  username?: string;
  role: 'user' | 'agency';
  locationId: string;
  installMode: InstallMode;
};

const COOKIE_NAME = 'pf_session';
const MAX_AGE = 60 * 60 * 24 * 7;

function sessionSecret() {
  const value = String(process.env.SESSION_SECRET || '');
  if (value.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return new TextEncoder().encode(value);
}

export async function createSessionToken(input: Omit<Session, 'installMode'> & { installMode?: InstallMode }) {
  return new SignJWT({
    userId: input.userId,
    username: input.username,
    role: input.role,
    locationId: input.locationId,
    installMode: input.installMode || (input.role === 'agency' ? 'agency' : 'subaccount'),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(sessionSecret());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ['HS256'] });
    const role = payload.role === 'agency' ? 'agency' : payload.role === 'user' ? 'user' : null;
    const locationId = typeof payload.locationId === 'string' ? payload.locationId.trim() : '';
    if (!role || !locationId) return null;
    return {
      userId: typeof payload.userId === 'string' || typeof payload.userId === 'number' ? payload.userId : undefined,
      username: typeof payload.username === 'string' ? payload.username : undefined,
      role,
      locationId,
      installMode: payload.installMode === 'agency' || role === 'agency' ? 'agency' : 'subaccount',
    };
  } catch {
    return null;
  }
}

// Runtime result is Session|null. Keep the historical loose return type while
// older route callers are migrated; middleware now blocks anonymous page access.
export async function getSession(): Promise<any> {
  const token = cookies().get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

export function applySessionCookie(response: NextResponse, token: string, ..._legacyArgs: unknown[]) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
  return response;
}

export function clearSession(response?: NextResponse) {
  if (response) {
    response.cookies.set(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return response;
  }
  cookies().delete(COOKIE_NAME);
}

export function clearExistingSession(response?: NextResponse) {
  return clearSession(response);
}
