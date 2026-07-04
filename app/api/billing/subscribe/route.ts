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
  const billingCycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const planId = Number(body.planId);

  const plans = await query<any[]>('SELECT * FROM agency_plans WHERE id = ? AND is_active = 1 LIMIT 1', [planId]);
  if (!plans.length) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  const plan = plans[0];

  const agencySettings = await getAgencySettings();
  if (!agencySettings?.merchant_id || !agencySettings?.merchant_key) {
    return NextResponse.json({ error: 'PayFast credentials are not configured yet' }, { status: 400 });
  }

  const installations = await query<any[]>('SELECT company_id FROM installations WHERE location_id = ? LIMIT 1', [session.locationId]);
  const invoiceToken = generateToken(16);
  const amount = billingCycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly);

  await query(
    `INSERT INTO billing_invoices (location_id, plan_id, amount, status, token, period_start, period_end)
     VALUES (?, ?, ?, 'pending', ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 ${billingCycle === 'yearly' ? 'YEAR' : 'MONTH'}))`,
    [session.locationId, planId, amount, invoiceToken]
  );

  const form = await buildAgencyBillingForm({
    amount: amount.toFixed(2),
    itemName: `${plan.name} Plan`,
    itemDescription: `${billingCycle} subscription for ${session.locationId}`,
    emailAddress: body.email || `${session.locationId}@crm.local`,
    phone: body.phone || '',
    nameFirst: body.nameFirst || installations[0]?.company_id || 'Client',
    nameLast: body.nameLast || '.',
    locationId: session.locationId,
    invoiceToken,
  });

  return NextResponse.json({ actionUrl: form.actionUrl, fields: form.fields, invoiceToken });
}
