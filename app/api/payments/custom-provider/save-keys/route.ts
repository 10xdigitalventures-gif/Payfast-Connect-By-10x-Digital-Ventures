import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getMarketplaceToken } from '@/lib/ghl-provider';

// Admin endpoint — save per-location provider api keys (used by marketplace)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { locationId, providerApiKey, publishableKey } = body;
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 });

  // Require marketplace token in Authorization header or an ADMIN_API_SECRET to protect this endpoint
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const expected = getMarketplaceToken();
  const adminSecret = process.env.ADMIN_API_SECRET || null;

  const authorized = (expected && token && token === expected) || (adminSecret && token && token === adminSecret);
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  await query(
    `UPDATE installations SET provider_api_key = ?, provider_publishable_key = ? WHERE location_id = ?`,
    [providerApiKey || null, publishableKey || null, locationId]
  );

  return NextResponse.json({ success: true });
}
