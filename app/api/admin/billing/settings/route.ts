import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAgencySettings } from '@/lib/billing';

export async function GET() {
  await query(
    `CREATE TABLE IF NOT EXISTS agency_legal_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      terms_url VARCHAR(1000) NULL,
      privacy_policy_url VARCHAR(1000) NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  return NextResponse.json((await getAgencySettings()) || null);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  await query(
    `CREATE TABLE IF NOT EXISTS agency_legal_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      terms_url VARCHAR(1000) NULL,
      privacy_policy_url VARCHAR(1000) NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await query(
    `INSERT INTO agency_settings (id, merchant_id, merchant_key, merchant_name, store_id, passphrase, environment, grace_period_days, trial_days, notify_email)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       merchant_id = VALUES(merchant_id),
       merchant_key = VALUES(merchant_key),
       merchant_name = VALUES(merchant_name),
       store_id = VALUES(store_id),
       passphrase = VALUES(passphrase),
       environment = VALUES(environment),
       grace_period_days = VALUES(grace_period_days),
       trial_days = VALUES(trial_days),
       notify_email = VALUES(notify_email)`,
    [
      body.merchant_id || null,
      body.merchant_key || null,
      body.merchant_name || null,
      body.store_id || null,
      body.passphrase || null,
      body.environment || 'live',
      Number(body.grace_period_days || 3),
      Number(body.trial_days || 14),
      body.notify_email || null,
    ]
  );

  await query(
    `INSERT INTO agency_legal_links (id, terms_url, privacy_policy_url)
     VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE
       terms_url = VALUES(terms_url),
       privacy_policy_url = VALUES(privacy_policy_url)`,
    [body.terms_url || null, body.privacy_policy_url || null]
  );

  return NextResponse.json({ success: true });
}
