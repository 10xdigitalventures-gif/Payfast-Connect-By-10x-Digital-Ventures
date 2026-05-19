import { NextRequest, NextResponse } from 'next/server';
import { query, Installation } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  
  // Bypass mode for testing - no session required
  const bypassMode = searchParams.get('preview') === 'true' || searchParams.get('demo') === 'true';
  
  if (!session && !bypassMode) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // If bypass mode, return demo/sample settings
  if (bypassMode) {
    return NextResponse.json({
      merchant_name:       'Demo Merchant',
      store_id:            'demo-store-001',
      merchant_id:         '26290',
      merchant_key:        'demo-secured-key',
      passphrase:          'demo-passphrase',
      environment:         'sandbox',
      tag_on_payment:      'paid,customer,demo',
      tag_on_fail:         'payment-failed,demo',
      move_opp_stage:      'won',
      auto_create_contact: true,
      fire_workflow:       true,
      _mode:               'bypass/demo',
      _note:               'These are demo settings. Login to see real data.',
      login_username:      'user_demo',
      login_password:      'demo-password'
    });
  }

  const rows = await query<Installation[]>(
    `SELECT merchant_name, store_id, merchant_id, merchant_key, passphrase, environment,
            tag_on_payment, tag_on_fail, move_opp_stage,
            auto_create_contact, fire_workflow
     FROM installations WHERE location_id = ?`,
    [session!.locationId]
  );
  
  if (!rows.length) return NextResponse.json(null);

  const r = rows[0];
  const creds = await query<any[]>(
    'SELECT username, password FROM installation_credentials WHERE location_id = ? LIMIT 1',
    [session!.locationId]
  );

  return NextResponse.json({
    merchant_name:       r.merchant_name      || '',
    store_id:            r.store_id           || '',
    merchant_id:         r.merchant_id        || '',
    merchant_key:        r.merchant_key       || '',
    passphrase:          r.passphrase         || '',
    environment:         r.environment,
    tag_on_payment:      r.tag_on_payment,
    tag_on_fail:         r.tag_on_fail,
    move_opp_stage:      r.move_opp_stage,
    auto_create_contact: !!r.auto_create_contact,
    fire_workflow:       !!r.fire_workflow,
    login_username:      creds[0]?.username || '',
    login_password:      creds[0]?.password || '',
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    merchant_name,
    store_id,
    merchant_id,
    merchant_key,
    passphrase,
    environment,
    tag_on_payment,
    tag_on_fail,
    move_opp_stage,
    auto_create_contact,
    fire_workflow,
  } = body;

  await query(
    `UPDATE installations SET
       merchant_name       = ?,
       store_id            = ?,
       merchant_id         = ?,
       merchant_key        = ?,
       passphrase          = ?,
       environment         = ?,
       tag_on_payment      = ?,
       tag_on_fail         = ?,
       move_opp_stage      = ?,
       auto_create_contact = ?,
       fire_workflow       = ?
     WHERE location_id = ?`,
    [
      merchant_name || null,
      store_id || null,
      merchant_id,
      merchant_key,
      passphrase || null,
      environment || 'live',
      tag_on_payment || 'paid,customer',
      tag_on_fail    || 'payment-failed',
      move_opp_stage || 'won',
      auto_create_contact ? 1 : 0,
      fire_workflow ? 1 : 0,
      session.locationId,
    ]
  );

  return NextResponse.json({ success: true });
}
