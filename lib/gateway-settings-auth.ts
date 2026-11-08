import { verifyGatewaySettingsToken } from '@/lib/gateway-marketplace-token';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';

type Gateway = 'payfast' | 'whop' | 'swich';

/**
 * Fail-closed location authorization for standalone gateway settings.
 * Do not authorize from a query parameter, OAuth installation existence,
 * or an agency role alone. Future agency delegation must use an explicit
 * verified location membership lookup.
 */
export async function authorizeGatewayLocation(
  provider: Gateway,
  locationId: unknown,
  request?: NextRequest,
): Promise<{ ok: true; locationId: string } | { ok: false; response: NextResponse }> {
  if (typeof locationId !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(locationId)) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid location' }, { status: 400 }) };
  }
  // In Marketplace iframe, use the scoped bearer obtained from encrypted
  // HighLevel context. Do not fall back to cookies for an invalid bearer.
  const authorization = request?.headers.get('authorization');
  if (authorization) {
    const token = authorization.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1] || '';
    const valid = await verifyGatewaySettingsToken(token, provider, locationId);
    return valid
      ? { ok: true, locationId }
      : { ok: false, response: NextResponse.json({ error: 'Invalid marketplace session' }, { status: 403 }) };
  }
  const session = await getSession();
  if (!session || session.installMode !== 'subaccount' || session.role !== 'user' ||
      session.locationId !== locationId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized gateway location' }, { status: 403 }) };
  }
  // Legacy first-party cookie path retained for backwards compatibility.
  // Marketplace bearer path above is always bound to the requested provider.
  return { ok: true, locationId };
}
