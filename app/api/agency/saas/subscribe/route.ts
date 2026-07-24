import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';
import { getAgencySettings } from '@/lib/billing';
import { createWhopCheckout, convertPkrToUsd, resolveExchangeRate, billingPeriodDaysForFrequency, getMappedWhopPlan, upsertWhopPlanMap } from '@/lib/whop';

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

  // Trial length: per-plan trial_days, falling back to the agency default.
  // The trial is Whop-managed (baked into the plan) so Whop defers the first
  // charge; grace_period_days is a separate post-failure window, not a trial.
  const trialDays = Number(plan.trial_days ?? settings.trial_days ?? 0) || 0;
  const trialEndsAt = trialDays > 0 ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null;

  if (provider === 'whop') {
    if (!settings.whop_api_key || !settings.whop_company_id) {
      return NextResponse.json({ error: 'Agency Whop credentials are not configured' }, { status: 400 });
    }

    const feePercent = Number(settings.whop_fee_percent || 0);
    const { rate } = await resolveExchangeRate(settings.whop_rate_mode, Number(settings.whop_exchange_rate || 280));
    const usdAmount = Math.round(convertPkrToUsd(pkrAmount, feePercent, rate) * 100) / 100;
    const freqKey = isYearly ? 'yearly' : 'monthly';
    const billingPeriodDays = billingPeriodDaysForFrequency(freqKey);
    const companyId = String(settings.whop_company_id);
    const config = { apiKey: settings.whop_api_key, companyId, exchangeRate: rate, feePercent };

    const metadata = {
      kind: 'agency_saas',
      basketId,
      location_id: locationId,
      plan_id: String(planId),
      frequency: freqKey,
      customer_email: email,
      pkr_amount: String(pkrAmount),
      usd_charged: String(usdAmount),
      trial_days: String(trialDays),
    };

    // One stable Whop plan per (GHL plan x frequency x agency Whop account).
    // Reuse the mapped plan when the USD price is unchanged; otherwise mint a
    // new plan (price/exchange-rate changed) and refresh the mapping. Either
    // way we send THIS customer's metadata so the session-scoped purchase_url
    // routes the resulting membership back to the correct sub-account.
    const mapped = await getMappedWhopPlan(planId, freqKey, companyId);
    const reuse = !!(mapped && mapped.whop_plan_id && Number(mapped.usd_amount) === usdAmount && Number(mapped.trial_period_days || 0) === trialDays);

    // After checkout, redirect the customer to the billing page so they see the
    // updated subscription status (instead of staying on Whop's own dashboard).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const postCheckoutRedirect = `${appUrl}/billing?success=1&location_id=${encodeURIComponent(locationId)}`;

    let result;
    if (reuse && mapped) {
      result = await createWhopCheckout({ config, usdAmount, existingPlanId: mapped.whop_plan_id, metadata, redirectUrl: postCheckoutRedirect });
    } else {
      result = await createWhopCheckout({ config, usdAmount, planType: 'renewal', billingPeriodDays, trialPeriodDays: trialDays, metadata, redirectUrl: postCheckoutRedirect });
      if (result.ok && result.planId) {
        await upsertWhopPlanMap({
          agencyPlanId: planId,
          frequency: freqKey,
          whopCompanyId: companyId,
          whopPlanId: result.planId,
          usdAmount,
          billingPeriodDays,
          trialPeriodDays: trialDays,
        });
      }
    }

    const redirectUrl = result.checkoutUrl || result.purchaseUrl;
    if (!result.ok || !redirectUrl) {
      return NextResponse.json({ error: result.error || 'Could not create Whop checkout' }, { status: 502 });
    }

    // Pending row; the webhook flips it to active (or trial) and fills the Whop
    // identifiers. Seed trial_ends_at so the dashboard shows the trial window
    // even before Whop's first membership webhook lands.
    await query(
      `INSERT INTO location_subscriptions
        (location_id, plan_id, provider, status, amount, payer_email, trial_ends_at)
       VALUES (?, ?, 'whop', 'trial', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         plan_id = VALUES(plan_id),
         provider = 'whop',
         amount = VALUES(amount),
         payer_email = VALUES(payer_email),
         trial_ends_at = COALESCE(VALUES(trial_ends_at), trial_ends_at)`,
      [locationId, planId, pkrAmount, email, trialEndsAt]
    );

    return NextResponse.json({ provider: 'whop', redirectUrl, basketId, usdAmount, whopPlanId: result.planId, reusedPlan: reuse });
  }

  // PayFast path — record intent; GHL SaaS Configurator drives the charge.
  await query(
    `INSERT INTO location_subscriptions
      (location_id, plan_id, provider, status, amount, payer_email, trial_ends_at)
     VALUES (?, ?, 'payfast', 'trial', ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       plan_id = VALUES(plan_id),
       provider = 'payfast',
       amount = VALUES(amount),
       payer_email = VALUES(payer_email),
       trial_ends_at = COALESCE(VALUES(trial_ends_at), trial_ends_at)`,
    [locationId, planId, pkrAmount, email, trialEndsAt]
  );

  return NextResponse.json({
    provider: 'payfast',
    message: 'PayFast SaaS subscription recorded. Charging is handled by the GHL SaaS Configurator via the custom provider (cron backup enabled).',
    basketId,
  });
}
