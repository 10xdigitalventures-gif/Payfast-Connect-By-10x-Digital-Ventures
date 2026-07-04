import { NextRequest, NextResponse } from 'next/server';
import {
  ensureCustomProviderProvisioned,
  connectProviderConfig,
} from '@/lib/ghl-provider';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const locationId = String(body.locationId || session.locationId || '').trim();

  if (!locationId) {
    return NextResponse.json({ error: 'locationId required' }, { status: 400 });
  }

  // Step 1 — make sure the provider is registered for this location.
  const reg = await ensureCustomProviderProvisioned(locationId, { appType: 'normal' });

  // Step 2 — if caller wants to connect-config right now (credentials present),
  // call connect to flip the tile.
  const wantsConnect =
    body.connect === true ||
    body.merchantId ||
    body.merchant_id;

  let connect: any = null;
  if (wantsConnect) {
    const mode: 'live' | 'test' =
      body.environment === 'sandbox' || body.environment === 'test' ? 'test' : 'live';
    connect = await connectProviderConfig(locationId, mode, 'normal');
  }

  return NextResponse.json({
    register: reg,
    connect,
  });
}
