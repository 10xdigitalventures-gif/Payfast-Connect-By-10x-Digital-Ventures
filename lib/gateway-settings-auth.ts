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
): Promise<{ ok: true; locationId: string } | { ok: false; response: NextResponse }> {
  if (typeof locationId !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(locationId)) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid location' }, { status: 400 }) };
  }
  const session = await getSession();
  if (!session || session.installMode !== 'subaccount' || session.role !== 'user' ||
      session.locationId !== locationId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized gateway location' }, { status: 403 }) };
  }
  // Provider is intentionally part of the API contract for later per-app
  // session binding. A shared CRM session does not prove app-specific OAuth.
  void provider;
  return { ok: true, locationId };
}
