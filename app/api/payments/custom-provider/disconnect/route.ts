import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { disconnectCustomProvider } from '@/lib/ghl-provider';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId } = body;

    if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 });

    // 1. Tell GHL to disconnect the provider
    await disconnectCustomProvider(locationId);

    // 2. Clear our local config
    await query(
      `UPDATE installations 
       SET merchant_id = NULL, merchant_key = NULL, passphrase = NULL, environment = NULL 
       WHERE location_id = ?`,
      [locationId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Disconnect Provider] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
