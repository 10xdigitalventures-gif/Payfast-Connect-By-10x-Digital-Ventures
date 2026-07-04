import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  registerProviderForLocation,
  connectProviderConfig,
  updateProviderCapabilities,
} from '@/lib/ghl-provider';

// Fields this config surface owns. CRM automation fields (tags, workflow, etc.)
// are intentionally left untouched here so the embedded page never wipes them.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');

  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 });

  const rows = await query<any[]>(
    `SELECT merchant_id, merchant_name, store_id, merchant_key, passphrase, environment,
            whop_enabled, whop_api_key, whop_company_id, whop_webhook_secret,
            whop_exchange_rate, whop_fee_percent, whop_rate_mode,
            whop_currency, route_oneoff, route_subscription
     FROM installations WHERE location_id = ?`,
    [locationId]
  );

  if (!rows.length) return NextResponse.json({ installed: false });

  const r = rows[0];
  return NextResponse.json({
    installed:           true,
    merchant_id:         r.merchant_id   || '',
    merchant_name:       r.merchant_name || '',
    store_id:            r.store_id      || '',
    merchant_key:        r.merchant_key  || '',
    passphrase:          r.passphrase    || '',
    environment:         r.environment   || 'live',
    whop_enabled:        !!r.whop_enabled,
    whop_api_key:        r.whop_api_key        || '',
    whop_company_id:     r.whop_company_id     || '',
    whop_webhook_secret: r.whop_webhook_secret || '',
    whop_exchange_rate:  r.whop_exchange_rate != null ? String(r.whop_exchange_rate) : '280',
    whop_fee_percent:    r.whop_fee_percent   != null ? String(r.whop_fee_percent)   : '10',
    whop_rate_mode:      r.whop_rate_mode || 'fixed',
    whop_currency:       r.whop_currency  || 'PKR',
    route_oneoff:        r.route_oneoff        || 'payfast',
    route_subscription:  r.route_subscription  || 'whop',
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    locationId,
    merchant_id,
    merchant_name,
    store_id,
    merchant_key,
    passphrase,
    environment,
    whop_enabled,
    whop_api_key,
    whop_company_id,
    whop_webhook_secret,
    whop_exchange_rate,
    whop_fee_percent,
    whop_rate_mode,
    whop_currency,
    route_oneoff,
    route_subscription,
  } = body;

  if (!locationId)   return NextResponse.json({ error: 'locationId required' }, { status: 400 });
  if (!merchant_id)  return NextResponse.json({ error: 'merchant_id required' }, { status: 400 });
  if (!store_id)     return NextResponse.json({ error: 'store_id required' }, { status: 400 });
  if (!merchant_key) return NextResponse.json({ error: 'merchant_key required' }, { status: 400 });

  // Whop requires its credentials only when it is enabled.
  if (whop_enabled && (!whop_api_key || !whop_company_id)) {
    return NextResponse.json(
      { error: 'Whop API key and Company ID are required when Whop is enabled' },
      { status: 400 }
    );
  }

  const mode: 'live' | 'test' = environment === 'sandbox' || environment === 'test' ? 'test' : 'live';
  const rate = Number(whop_exchange_rate);
  const fee = Number(whop_fee_percent);

  const managedValues = [
    merchant_id,
    merchant_name || null,
    store_id,
    merchant_key,
    passphrase || null,
    environment || 'live',
    whop_enabled ? 1 : 0,
    whop_api_key || null,
    whop_company_id || null,
    whop_webhook_secret || null,
    Number.isFinite(rate) && rate > 0 ? rate : 280,
    Number.isFinite(fee) && fee >= 0 ? fee : 10,
    whop_rate_mode === 'live' ? 'live' : 'fixed',
    whop_currency === 'USD' ? 'USD' : 'PKR',
    route_oneoff === 'whop' ? 'whop' : 'payfast',
    route_subscription === 'payfast' ? 'payfast' : 'whop',
  ];

  const exists = await query<any[]>(
    'SELECT id FROM installations WHERE location_id = ?',
    [locationId]
  );

  if (exists.length) {
    await query(
      `UPDATE installations SET
         merchant_id = ?, merchant_name = ?, store_id = ?, merchant_key = ?, passphrase = ?,
         environment = ?, whop_enabled = ?, whop_api_key = ?, whop_company_id = ?,
         whop_webhook_secret = ?, whop_exchange_rate = ?, whop_fee_percent = ?,
         whop_rate_mode = ?, whop_currency = ?, route_oneoff = ?, route_subscription = ?
       WHERE location_id = ?`,
      [...managedValues, locationId]
    );
  } else {
    await query(
      `INSERT INTO installations
         (merchant_id, merchant_name, store_id, merchant_key, passphrase,
          environment, whop_enabled, whop_api_key, whop_company_id,
          whop_webhook_secret, whop_exchange_rate, whop_fee_percent,
          whop_rate_mode, whop_currency, route_oneoff, route_subscription,
          location_id, access_token, refresh_token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', NOW())`,
      [...managedValues, locationId]
    );
  }

  const reg = await registerProviderForLocation(locationId);
  const connect = await connectProviderConfig(locationId, mode);
  const caps = await updateProviderCapabilities(locationId);

  if (!connect.ok) {
    return NextResponse.json(
      {
        success: false,
        message: 'Saved your details but could not register the configuration with HighLevel. Please try again.',
        details: { register: reg, connect, capabilities: caps },
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    mode,
    details: { register: reg, connect: { ok: connect.ok }, capabilities: caps },
  });
}
