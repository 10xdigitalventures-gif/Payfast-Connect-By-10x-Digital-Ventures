import { NextRequest, NextResponse } from 'next/server';
import { query, Installation } from '@/lib/db';
import { getSession } from '@/lib/session';

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });

  const rows = await query<Installation[]>(
    `SELECT merchant_name, store_id, merchant_id, merchant_key, passphrase, environment,
            whop_enabled, whop_api_key, whop_company_id, whop_webhook_secret,
            whop_exchange_rate, whop_fee_percent, whop_rate_mode,
            whop_currency, route_oneoff, route_subscription,
            tag_on_payment, tag_on_fail, move_opp_stage,
            auto_create_contact, fire_workflow
       FROM installations
      WHERE location_id = ?
      LIMIT 1`,
    [session.locationId],
  );
  if (!rows.length) return NextResponse.json(null, { headers: noStore });

  const credentials = await query<any[]>(
    'SELECT username FROM installation_credentials WHERE location_id=? LIMIT 1',
    [session.locationId],
  );
  const r = rows[0];
  return NextResponse.json({
    merchant_name: r.merchant_name || '',
    store_id: r.store_id || '',
    merchant_id: r.merchant_id || '',
    merchant_key: r.merchant_key || '',
    passphrase: r.passphrase || '',
    environment: r.environment,
    whop_enabled: !!r.whop_enabled,
    whop_api_key: r.whop_api_key || '',
    whop_company_id: r.whop_company_id || '',
    whop_webhook_secret: r.whop_webhook_secret || '',
    whop_exchange_rate: r.whop_exchange_rate != null ? String(r.whop_exchange_rate) : '280',
    whop_fee_percent: r.whop_fee_percent != null ? String(r.whop_fee_percent) : '10',
    whop_rate_mode: r.whop_rate_mode || 'fixed',
    whop_currency: r.whop_currency || 'PKR',
    route_oneoff: r.route_oneoff || 'payfast',
    route_subscription: r.route_subscription || 'whop',
    tag_on_payment: r.tag_on_payment,
    tag_on_fail: r.tag_on_fail,
    move_opp_stage: r.move_opp_stage,
    auto_create_contact: !!r.auto_create_contact,
    fire_workflow: !!r.fire_workflow,
    login_username: credentials[0]?.username || '',
  }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });

  const body = await request.json();
  const rate = Number(body.whop_exchange_rate);
  const fee = Number(body.whop_fee_percent);
  await query(
    `UPDATE installations SET
       merchant_name=?, store_id=?, merchant_id=?, merchant_key=?, passphrase=?, environment=?,
       whop_enabled=?, whop_api_key=?, whop_company_id=?, whop_webhook_secret=?,
       whop_exchange_rate=?, whop_fee_percent=?, whop_rate_mode=?, whop_currency=?,
       route_oneoff=?, route_subscription=?, tag_on_payment=?, tag_on_fail=?,
       move_opp_stage=?, auto_create_contact=?, fire_workflow=?
     WHERE location_id=?`,
    [
      body.merchant_name || null,
      body.store_id || null,
      body.merchant_id,
      body.merchant_key,
      body.passphrase || null,
      body.environment || 'live',
      body.whop_enabled ? 1 : 0,
      body.whop_api_key || null,
      body.whop_company_id || null,
      body.whop_webhook_secret || null,
      Number.isFinite(rate) && rate > 0 ? rate : 280,
      Number.isFinite(fee) && fee >= 0 ? fee : 10,
      body.whop_rate_mode === 'live' ? 'live' : 'fixed',
      body.whop_currency === 'USD' ? 'USD' : 'PKR',
      body.route_oneoff === 'whop' ? 'whop' : 'payfast',
      body.route_subscription === 'payfast' ? 'payfast' : 'whop',
      body.tag_on_payment || 'paid,customer',
      body.tag_on_fail || 'payment-failed',
      body.move_opp_stage || 'won',
      body.auto_create_contact ? 1 : 0,
      body.fire_workflow ? 1 : 0,
      session.locationId,
    ],
  );
  return NextResponse.json({ success: true }, { headers: noStore });
}
