import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  registerProviderForLocation,
  connectProviderConfig,
  updateProviderCapabilities,
} from '@/lib/ghl-provider';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');

  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 });

  const rows = await query<any[]>(
    `SELECT merchant_id, merchant_name, store_id, merchant_key, passphrase, environment
     FROM installations WHERE location_id = ?`,
    [locationId]
  );

  if (!rows.length) return NextResponse.json({});

  return NextResponse.json({
    merchant_id:   rows[0].merchant_id   || '',
    merchant_name: rows[0].merchant_name || '',
    store_id:      rows[0].store_id      || '',
    merchant_key:  rows[0].merchant_key  || '',
    passphrase:    rows[0].passphrase    || '',
    environment:   rows[0].environment   || 'live',
  });
}

export async function POST(request: NextRequest) {
  const {
    locationId,
    merchant_id,
    merchant_name,
    store_id,
    merchant_key,
    passphrase,
    environment,
  } = await request.json();

  if (!locationId)   return NextResponse.json({ error: 'locationId required' }, { status: 400 });
  if (!merchant_id)  return NextResponse.json({ error: 'merchant_id required' }, { status: 400 });
  if (!store_id)     return NextResponse.json({ error: 'store_id required' }, { status: 400 });
  if (!merchant_key) return NextResponse.json({ error: 'merchant_key required' }, { status: 400 });

  const mode: 'live' | 'test' = environment === 'sandbox' || environment === 'test' ? 'test' : 'live';

  const exists = await query<any[]>(
    'SELECT id FROM installations WHERE location_id = ?',
    [locationId]
  );

  if (exists.length) {
    await query(
      `UPDATE installations
       SET merchant_id = ?, merchant_name = ?, store_id = ?,
           merchant_key = ?, passphrase = ?, environment = ?
       WHERE location_id = ?`,
      [
        merchant_id,
        merchant_name || null,
        store_id,
        merchant_key,
        passphrase || null,
        environment || 'live',
        locationId,
      ]
    );
  } else {
    await query(
      `INSERT INTO installations
         (location_id, merchant_id, merchant_name, store_id,
          merchant_key, passphrase, environment,
          access_token, refresh_token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', '', NOW())
       ON DUPLICATE KEY UPDATE
         merchant_id   = VALUES(merchant_id),
         merchant_name = VALUES(merchant_name),
         store_id      = VALUES(store_id),
         merchant_key  = VALUES(merchant_key),
         passphrase    = VALUES(passphrase),
         environment   = VALUES(environment)`,
      [
        locationId,
        merchant_id,
        merchant_name || null,
        store_id || null,
        merchant_key,
        passphrase || null,
        environment || 'live',
      ]
    );
  }

  const reg = await registerProviderForLocation(locationId);
  const connect = await connectProviderConfig(locationId, mode);
  const caps = await updateProviderCapabilities(locationId);

  if (!connect.ok) {
    return NextResponse.json({
      success: false,
      message: 'Saved credentials but failed to register configuration with HighLevel. Please retry.',
      details: { register: reg, connect, capabilities: caps },
    }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    details: { register: reg, connect: { ok: connect.ok }, capabilities: caps },
  });
}
