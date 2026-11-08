import { NextRequest, NextResponse } from 'next/server';
import { beginGatewayOAuth, setGatewayOAuthCookie } from '@/lib/gateway-oauth-flow';
import type { GatewayOAuthProvider } from '@/lib/gateway-oauth-state';

export const dynamic = 'force-dynamic';
const providers: GatewayOAuthProvider[] = ['payfast', 'whop', 'swich'];
const scopes = [
  'payments/orders.readonly',
  'payments/orders.write',
  'payments/transactions.readonly',
  'payments/subscriptions.readonly',
  'payments/custom-provider.readonly',
  'payments/custom-provider.write',
  'products.readonly',
  'products/prices.readonly',
].join(' ');

/** Optional controlled initiation. Native HighLevel Marketplace install links
 * are a different path; their code-only callbacks cannot be treated as if
 * HighLevel returned our signed state. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await context.params;
  if (!providers.includes(rawProvider as GatewayOAuthProvider)) {
    return NextResponse.json({ error: 'Unknown gateway' }, { status: 404 });
  }
  const provider = rawProvider as GatewayOAuthProvider;
  const clientId = process.env[`${provider.toUpperCase()}_GHL_CLIENT_ID`];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !appUrl) return NextResponse.json({ error: 'Marketplace OAuth not configured' }, { status: 503 });
  let origin: string;
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('HTTPS required');
    origin = parsed.origin;
  } catch {
    return NextResponse.json({ error: 'Invalid application URL' }, { status: 503 });
  }
  try {
    const { state, nonce } = await beginGatewayOAuth(provider);
    const authorize = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('redirect_uri', `${origin}/oauth/${provider}/callback`);
    authorize.searchParams.set('scope', scopes);
    authorize.searchParams.set('state', state);
    const response = NextResponse.redirect(authorize);
    response.headers.set('Cache-Control', 'no-store');
    setGatewayOAuthCookie(response, provider, nonce);
    return response;
  } catch (error) {
    console.error('[Gateway OAuth] controlled initiation failed', provider, error);
    return NextResponse.json({ error: 'OAuth initialization unavailable; confirm database migration and configuration' }, { status: 503 });
  }
}
