import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  ensureCustomProviderProvisioned,
  connectProviderConfig,
} from '@/lib/ghl-provider';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await request.json();

  const rows = await query<any[]>(
    'SELECT * FROM merchant_applications WHERE id = ?',
    [id]
  );

  if (!rows.length) {
    return NextResponse.json(
      { error: 'Application not found' },
      { status: 404 }
    );
  }

  const app = rows[0];

  const status = body.status || app.status;
  const merchantId = body.pf_merchant_id ?? app.pf_merchant_id ?? null;
  const merchantKey = body.pf_merchant_key ?? app.pf_merchant_key ?? null;
  const passphrase = body.pf_passphrase ?? app.pf_passphrase ?? null;

  await query(
    `UPDATE merchant_applications
     SET status = ?,
         pf_merchant_id = ?,
         pf_merchant_key = ?,
         pf_passphrase = ?,
         admin_notes = ?,
         rejection_reason = ?,
         reviewed_by = ?,
         reviewed_at = NOW()
     WHERE id = ?`,
    [
      status,
      merchantId,
      merchantKey,
      passphrase,
      body.admin_notes ?? app.admin_notes ?? null,
      body.rejection_reason ?? app.rejection_reason ?? null,
      body.reviewed_by ?? 'admin',
      id,
    ]
  );

  if (app.ghl_location_id && merchantId && merchantKey) {
    const installations = await query<any[]>(
      'SELECT id FROM installations WHERE location_id = ?',
      [app.ghl_location_id]
    );

    if (installations.length) {
      await query(
        `UPDATE installations
         SET merchant_id = ?,
             merchant_key = ?,
             passphrase = ?
         WHERE location_id = ?`,
        [merchantId, merchantKey, passphrase, app.ghl_location_id]
      );
    } else {
      await query(
        `INSERT INTO installations
         (
           location_id,
           merchant_id,
           merchant_key,
           passphrase,
           environment,
           access_token,
           refresh_token,
           expires_at
         )
         VALUES (?, ?, ?, ?, 'live', '', '', NOW())`,
        [app.ghl_location_id, merchantId, merchantKey, passphrase]
      );
    }

    // Register the provider for this location. This should be idempotent.
    try {
      await ensureCustomProviderProvisioned(app.ghl_location_id, {
        appType: 'normal',
      });
    } catch (provErr) {
      console.warn(
        '[Admin Approve] provider registration failed (continuing):',
        provErr
      );
    }

    // Credentials are now in DB — flip the tile to "Connected" in GHL.
    try {
      await connectProviderConfig(app.ghl_location_id, 'live', 'normal');
    } catch (connErr) {
      console.warn(
        '[Admin Approve] provider connect-config failed (continuing):',
        connErr
      );
    }
  }

  return NextResponse.json({ success: true });
}