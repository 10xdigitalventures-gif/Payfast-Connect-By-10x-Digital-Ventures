import { authorizeGatewayLocation } from '@/lib/gateway-settings-auth';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { provisionPayfastProvider } from '@/lib/payfast-ghl-provider';

function validLocation(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && !value.includes('{') && !value.includes('}');
}

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');
  if (!validLocation(locationId)) return NextResponse.json({ installed: false });
  const access = await authorizeGatewayLocation('payfast', locationId, request);
  if (!access.ok) return access.response;
  const rows = await query<any[]>(
    `SELECT merchant_id, merchant_name, store_id,
            (merchant_key IS NOT NULL AND merchant_key <> '') AS has_merchant_key,
            (passphrase IS NOT NULL AND passphrase <> '') AS has_passphrase,
            environment, access_token IS NOT NULL AS oauth_connected
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
    merchant_key: '',
    has_merchant_key: !!row.has_merchant_key,
    passphrase: '',
    has_passphrase: !!row.has_passphrase,
    environment: row.environment === 'live' ? 'live' : 'sandbox',
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const locationId = body.locationId;
  if (!validLocation(locationId)) return NextResponse.json({ error: 'A valid HighLevel location is required.' }, { status: 400 });
  const access = await authorizeGatewayLocation('payfast', locationId, request);
  if (!access.ok) return access.response;
  const merchantId = String(body.merchant_id || '').trim();
  const installation = await query<any[]>(
    'SELECT id, access_token, merchant_key, passphrase FROM payfast_ghl_installations WHERE location_id=? LIMIT 1',
    [locationId],
  );
  if (!installation.length || !installation[0].access_token) {
    return NextResponse.json({ error: 'Install the standalone PayFast GHL app before saving gateway credentials.' }, { status: 409 });
  }
  // The settings page never receives plaintext secrets on GET. A blank
  // password field means retain its existing value, not erase the merchant.
  const merchantKey = String(body.merchant_key || '').trim() ||
    String(installation[0].merchant_key || '').trim();
  const passphrase = body.clear_passphrase === true ? null :
    String(body.passphrase || '').trim() || installation[0].passphrase || null;
  if (!merchantId || !merchantKey) {
    return NextResponse.json({ error: 'Merchant ID and Merchant Key are required.' }, { status: 400 });
  }

  const environment = body.environment === 'live' ? 'live' : 'sandbox';
  await query(
    `UPDATE payfast_ghl_installations
        SET merchant_id=?, merchant_name=?, store_id=?, merchant_key=?, passphrase=?, environment=?, updated_at=NOW()
      WHERE location_id=?`,
    [merchantId, body.merchant_name || null, body.store_id || null, merchantKey, passphrase, environment, locationId],
  );

  const provisioned = await provisionPayfastProvider(locationId, environment === 'live' ? 'live' : 'test');
  if (!provisioned.ok) {
    return NextResponse.json({ success: false, saved: true, error: 'Credentials saved, but HighLevel provider registration failed.', detail: provisioned }, { status: 502 });
  }
  return NextResponse.json({ success: true, provider: 'payfast', environment });
}
