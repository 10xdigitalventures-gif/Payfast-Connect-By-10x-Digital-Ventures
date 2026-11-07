import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { decryptMarketplaceUserContext, gatewaySharedSecret, type MarketplaceProvider } from '@/lib/marketplace-sso';
import { createGatewaySettingsToken } from '@/lib/gateway-marketplace-token';

export const dynamic = 'force-dynamic';

const installations: Record<MarketplaceProvider, string> = {
  payfast: 'payfast_ghl_installations',
  whop: 'whop_ghl_installations',
  swich: 'swich_ghl_installations',
};

/**
 * Marketplace custom page: REQUEST_USER_DATA_RESPONSE.payload is encrypted
 * with the app's own Shared Secret. Verify its location/user on our backend,
 * then return an app-specific short-lived bearer (no third-party cookies).
 */
export async function POST(request: NextRequest) {
  const configuredOrigin = String(process.env.NEXT_PUBLIC_APP_URL || '');
  let origin: string;
  try { origin = new URL(configuredOrigin).origin; }
  catch { return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 }); }

  // Same-origin browser request; not a substitute for decrypting the payload.
  if (request.headers.get('origin') !== origin) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  }
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const provider: MarketplaceProvider = body?.provider;
  if (!Object.prototype.hasOwnProperty.call(installations, provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }
  const expectedLocation = body?.locationId;
  if (typeof expectedLocation !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(expectedLocation)) {
    return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
  }
  const secret = gatewaySharedSecret(provider);
  if (secret.length < 16) return NextResponse.json({ error: 'Marketplace SSO is not configured' }, { status: 503 });

  let context;
  try { context = decryptMarketplaceUserContext(body?.encryptedData, secret); }
  catch { return NextResponse.json({ error: 'Invalid HighLevel user context' }, { status: 401 }); }
  // Merchant credentials are privileged configuration. Do not grant a
  // settings token to an ordinary location user merely because they can open
  // the iframe; require a GHL administrator context.
  if (context.role !== 'admin') {
    return NextResponse.json({ error: 'HighLevel administrator access required' }, { status: 403 });
  }
  if (context.activeLocation !== expectedLocation) {
    return NextResponse.json({ error: 'HighLevel location mismatch' }, { status: 403 });
  }
  const rows = await query<any[]>(
    `SELECT company_id, access_token FROM ${installations[provider]} WHERE location_id=? LIMIT 1`,
    [context.activeLocation],
  );
  if (!rows[0]?.access_token) {
    return NextResponse.json({ error: 'Install this Marketplace app first' }, { status: 403 });
  }
  // If GHL includes agency ownership in both places they must agree.
  if (rows[0].company_id && context.companyId && String(rows[0].company_id) !== context.companyId) {
    return NextResponse.json({ error: 'HighLevel company mismatch' }, { status: 403 });
  }
  const token = await createGatewaySettingsToken(provider, context.activeLocation, context.userId);
  return NextResponse.json(
    { token, locationId: context.activeLocation, expiresIn: 900 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
