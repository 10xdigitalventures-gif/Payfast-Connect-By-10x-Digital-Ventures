import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { provisionPayfastProvider } from '@/lib/payfast-ghl-provider';

function validLocation(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && !value.includes('{') && !value.includes('}');
}

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');
  if (!validLocation(locationId)) return NextResponse.json({ installed: false });
  const rows = await query<any[]>(
    `SELECT merchant_id, merchant_name, store_id, merchant_key, passphrase, environment,
            access_token IS NOT NULL AS oauth_connected
       FROM payfast_ghl_installations WHERE location_id=? LIMIT 1`,
    [locationId],
  );
  if (!rows.length) return NextResponse.json({ installed: false, oauth_connected: false });
  const row = rows[0];
  return NextResponse.json({
    installed: true,
    oauth_connected: !!row.oauth_connected,
    merchant_id: row.merchant_id || '',
    merchant_name: row.merchant_name || '',
    store_id: row.store_id || '',
    merchant_key: row.merchant_key || '',
    passphrase: row.passphrase || '',
    environment: row.environment === 'live' ? 'live' : 'sandbox',
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const locationId = body.locationId;
  if (!validLocation(locationId)) return NextResponse.json({ error: 'A valid HighLevel location is required.' }, { status: 400 });
  const merchantId = String(body.merchant_id || '').trim();
  const merchantKey = String(body.merchant_key || '').trim();
  if (!merchantId || !merchantKey) return NextResponse.json({ error: 'Merchant ID and Merchant Key are required.' }, { status: 400 });

  const installation = await query<any[]>(
    'SELECT id, access_token FROM payfast_ghl_installations WHERE location_id=? LIMIT 1',
    [locationId],
  );
  if (!installation.length || !installation[0].access_token) {
    return NextResponse.json({ error: 'Install the standalone PayFast GHL app before saving gateway credentials.' }, { status: 409 });
  }

  const environment = body.environment === 'live' ? 'live' : 'sandbox';
  await query(
    `UPDATE payfast_ghl_installations
        SET merchant_id=?, merchant_name=?, store_id=?, merchant_key=?, passphrase=?, environment=?, updated_at=NOW()
      WHERE location_id=?`,
    [merchantId, body.merchant_name || null, body.store_id || null, merchantKey, body.passphrase || null, environment, locationId],
  );

  const provisioned = await provisionPayfastProvider(locationId, environment === 'live' ? 'live' : 'test');
  if (!provisioned.ok) {
    return NextResponse.json({ success: false, saved: true, error: 'Credentials saved, but HighLevel provider registration failed.', detail: provisioned }, { status: 502 });
  }
  return NextResponse.json({ success: true, provider: 'payfast', environment });
}
