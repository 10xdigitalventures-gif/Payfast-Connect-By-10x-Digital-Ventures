import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';
import { getAgencySettings } from '@/lib/billing';
import { createWhopCheckout, convertPkrToUsd, resolveExchangeRate, billingPeriodDaysForFrequency } from '@/lib/whop';

// Create an agency SaaS subscription checkout for a client sub-account.
//
// Whop path: creates a Whop renewal-plan checkout billed to the AGENCY's Whop
// account. Whop auto-bills each cycle and fires payment.succeeded; our webhook
// then records provider + Whop identifiers (member/payment_method/membership)
// into location_subscriptions so the subscription is tracked and chargeable by
// the cron backup.
//
// PayFast path: recorded here; the GHL SaaS Configurator (custom provider)
// drives the card capture + off-session charging, with our cron as backup.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.installMode !== 'agency') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const locationId = String(body.locationId || '').trim();
  const planId = Number(body.planId || 0);
  const email = String(body.email || '').trim();
  const frequency = String(body.frequency || 'monthly').toLowerCase();
  const isYearly = frequency === 'yearly' || frequency === 'annual' || frequency === 'annually';

  if (!locationId || !planId || !email) {
    return NextResponse.json({ error: 'locationId, planId and email are required' }, { status: 400 });
  }

  const settings = await getAgencySettings();
  if (!settings) return NextResponse.json({ error: 'Agency billing is not configured' }, { status: 400 });

  const planRows = await query<any[]>('SELECT * FROM agency_plans WHERE id = ? LIMIT 1', [planId]);
  if (!planRows.length) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  const plan = planRows[0];

  const provider = String(body.provider || settings.route_subscription || 'payfast').toLowerCase();
  const pkrAmount = Number(isYearly ? plan.price_yearly : plan.price_monthly) || 0;
  const basketId = `SAAS-${locationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (provider === 'whop') {
    if (!settings.whop_api_key || !settings.whop_company_id) {
      return NextResponse.json({ error: 'Agency Whop credentials are not configured' }, { status: 400 });
    }

    const feePercent = Number(settings.whop_fee_percent || 0);
    const { rate } = await resolveExchangeRate(settings.whop_rate_mode, Number(settings.whop_exchange_rate || 280));
    const usdAmount = convertPkrToUsd(pkrAmount, feePercent, rate);
    const billingPeriodDays = billingPeriodDaysForFrequency(isYearly ? 'yearly' : 'monthly');

    const result = await createWhopCheckout({
      config: { apiKey: settings.whop_api_key, companyId: settings.whop_company_id, exchangeRate: rate, feePercent },
      usdAmount,
      planType: 'renewal',
      billingPeriodDays,
      metadata: {
        kind: 'agency_saas',
        basketId,
        location_id: locationId,
        plan_id: String(planId),
        frequency: isYearly ? 'yearly' : 'monthly',
        customer_email: email,
        pkr_amount: String(pkrAmount),
        usd_charged: String(usdAmount),
      },
    });

    if (!result.ok || !result.checkoutUrl) {
      return NextResponse.json({ error: result.error || 'Could not create Whop checkout' }, { status: 502 });
    }

    // Pending row; the webhook flips it to active and fills the Whop identifiers.
    await query(
      `INSERT INTO location_subscriptions
        (location_id, plan_id, provider, status, amount, payer_email)
       VALUES (?, ?, 'whop', 'trial', ?, ?)
       ON DUPLICATE KEY UPDATE
         plan_id = VALUES(plan_id),
         provider = 'whop',
         amount = VALUES(amount),
         payer_email = VALUES(payer_email)`,
      [locationId, planId, pkrAmount, email]
    );

    return NextResponse.json({ provider: 'whop', redirectUrl: result.checkoutUrl, basketId, usdAmount });
  }

  // PayFast path — record intent; GHL SaaS Configurator drives the charge.
  await query(
    `INSERT INTO location_subscriptions
      (location_id, plan_id, provider, status, amount, payer_email)
     VALUES (?, ?, 'payfast', 'trial', ?, ?)
     ON DUPLICATE KEY UPDATE
       plan_id = VALUES(plan_id),
       provider = 'payfast',
       amount = VALUES(amount),
       payer_email = VALUES(payer_email)`,
    [locationId, planId, pkrAmount, email]
  );

  return NextResponse.json({
    provider: 'payfast',
    message: 'PayFast SaaS subscription recorded. Charging is handled by the GHL SaaS Configurator via the custom provider (cron backup enabled).',
    basketId,
  });
}
