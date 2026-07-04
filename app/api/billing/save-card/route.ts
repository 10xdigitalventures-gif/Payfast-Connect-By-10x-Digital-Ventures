import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';
import { generateToken } from '@/lib/tokens';
import { getAgencySettings } from '@/lib/billing';
import { buildAgencyBillingForm } from '@/lib/agency-payfast';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();
  const nameFirst = String(body.nameFirst || '').trim();
  const nameLast = String(body.nameLast || '.').trim() || '.';

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const agencySettings = await getAgencySettings();
  if (!agencySettings?.merchant_id || !agencySettings?.merchant_key) {
    return NextResponse.json({ error: 'PayFast credentials are not configured yet' }, { status: 400 });
  }

  const invoiceToken = generateToken(16);

  await query(
    `INSERT INTO billing_invoices (location_id, plan_id, amount, status, token)
     VALUES (?, NULL, ?, 'pending', ?)`,
    [session.locationId, 1, invoiceToken]
  );

  const form = await buildAgencyBillingForm({
    amount: '1.00',
    itemName: 'Card Verification',
    itemDescription: 'Save card for future rebilling',
    emailAddress: email,
    phone,
    nameFirst,
    nameLast,
    locationId: session.locationId,
    invoiceToken,
    successRedirect: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    callbackParams: { save_card: '1' },
  });

  return NextResponse.json({ actionUrl: form.actionUrl, fields: form.fields, invoiceToken });
}
