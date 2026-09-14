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
    `SELECT merchant_id, merchant_name, store_id, merchant_key, passphrase, environment
       FROM installations WHERE location_id=? LIMIT 1`,
    [locationId],
  );
  if (!rows.length) return NextResponse.json({ installed: false });
  const row = rows[0];
  return NextResponse.json({
    installed: true,
    merchant_id: row.merchant_id || '',
    merchant_name: row.merchant_name || '',
    store_id: row.store_id || '',
    merchant_key: row.merchant_key || '',
    passphrase: row.passphrase || '',
    environment: row.environment === 'sandbox' || row.environment === 'test' ? 'sandbox' : 'live',
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const locationId = body.locationId;
  if (!validLocation(locationId)) {
    return NextResponse.json({ error: 'A valid HighLevel location is required.' }, { status: 400 });
  }
  const merchantId = String(body.merchant_id || '').trim();
  const merchantKey = String(body.merchant_key || '').trim();
  if (!merchantId || !merchantKey) {
    return NextResponse.json({ error: 'Merchant ID and Merchant Key are required.' }, { status: 400 });
  }
  const environment = body.environment === 'sandbox' || body.environment === 'test' ? 'sandbox' : 'live';
  const exists = await query<any[]>('SELECT id FROM installations WHERE location_id=? LIMIT 1', [locationId]);
  if (exists.length) {
    await query(
      `UPDATE installations SET merchant_id=?, merchant_name=?, store_id=?, merchant_key=?, passphrase=?, environment=?,
       route_oneoff='payfast', route_subscription='payfast' WHERE location_id=?`,
      [merchantId, body.merchant_name || null, body.store_id || null, merchantKey, body.passphrase || null, environment, locationId],
    );
  } else {
    await query(
      `INSERT INTO installations
       (location_id, merchant_id, merchant_name, store_id, merchant_key, passphrase, environment,
        route_oneoff, route_subscription, access_token, refresh_token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'payfast', 'payfast', '', '', NOW())`,
      [locationId, merchantId, body.merchant_name || null, body.store_id || null, merchantKey, body.passphrase || null, environment],
    );
  }

  const provisioned = await provisionPayfastProvider(locationId, environment === 'sandbox' ? 'test' : 'live');
  if (!provisioned.ok) {
    return NextResponse.json({ success: false, saved: true, error: 'Credentials saved, but HighLevel provider registration failed.', detail: provisioned }, { status: 502 });
  }
  return NextResponse.json({ success: true, provider: 'payfast', environment });
}
