import { NextRequest, NextResponse } from 'next/server';
import { query, Installation } from '@/lib/db';
import { generateToken } from '@/lib/tokens';
import { convertPkrToUsd, calculateFeePkr, createWhopCheckout, resolveExchangeRate, billingPeriodDaysForFrequency } from '@/lib/whop';

// Whop counterpart of /api/ghl/pay.
// Creates a Whop hosted checkout and a pending payment row that the checkout
// iframe polls (via /api/ghl/payment-status) using the returned basketId.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    locationId,
    contactId,
    ghlTransactionId,
    invoiceId,
    orderId,
    subscriptionId,
    amount,
    description,
    nameFirst,
    nameLast,
    email,
    phone,
  } = body;

  if (!locationId || !amount || !email) {
    return NextResponse.json({ error: 'locationId, amount, email required' }, { status: 400 });
  }

  const rows = await query<Installation[]>(
    'SELECT * FROM installations WHERE location_id = ?',
    [locationId]
  );

  if (!rows.length || !rows[0].whop_api_key || !rows[0].whop_company_id) {
    return NextResponse.json({
      error: 'Whop is not configured for this location. Go to Settings → Whop and add your API key and Company ID.',
    }, { status: 400 });
  }

  const inst = rows[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const pkrTotal = parseFloat(amount);
  const feePercent = Number(inst.whop_fee_percent ?? 10);
  const fixedRate = Number(inst.whop_exchange_rate ?? 280);

  // Currency handling (configurable): when the GHL product is already priced
  // in USD we charge that amount plus the gateway fee directly; otherwise we
  // convert PKR→USD using the configured (or live) exchange rate. The stored
  // whop_currency default only applies when GHL doesn't send a currency.
  const productCurrency = String(body.currency || (inst as any).whop_currency || 'PKR').toUpperCase();
  const isUsdProduct = productCurrency === 'USD';

  let rate = 1;
  let rateSource: 'live' | 'fixed' = 'fixed';
  let usdAmount: number;
  if (isUsdProduct) {
    // Already USD — apply only the gateway fee (exchange rate of 1).
    usdAmount = convertPkrToUsd(pkrTotal, feePercent, 1);
  } else {
    const resolved = await resolveExchangeRate(inst.whop_rate_mode, fixedRate);
    rate = resolved.rate;
    rateSource = resolved.source;
    usdAmount = convertPkrToUsd(pkrTotal, feePercent, rate);
  }
  const feePkr = calculateFeePkr(pkrTotal, feePercent);

  // Subscription vs one-time. Subscriptions become Whop renewal plans so Whop
  // runs the recurring billing and emits a payment.succeeded webhook per cycle.
  const frequency = String(body.frequency || body.interval || body.billingCycle || '');
  const isSubscription = !!subscriptionId;
  const planType: 'one_time' | 'renewal' = isSubscription ? 'renewal' : 'one_time';
  const billingPeriodDays = isSubscription ? billingPeriodDaysForFrequency(frequency) : null;

  const payToken = generateToken(16);
  const basketId = `WHOP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Save a pending payment row (provider = whop). pf_token = basketId keeps the
  // existing status-polling and notify machinery provider-agnostic.
  await query(
    `INSERT INTO payments
      (location_id, contact_id, payer_email, payer_first, payer_last,
       amount, item_name, item_description, payment_type, provider, status,
       pf_token, custom_str1, custom_str2, custom_str3)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      locationId, contactId || null, email,
      nameFirst || '', nameLast || '.',
      pkrTotal,
      description || 'CRM Payment',
      JSON.stringify({
        invoiceId: invoiceId || null,
        orderId: orderId || null,
        contactId: contactId || null,
        usdAmount,
        feePkr,
        rate,
        rateMode: rateSource,
        feePercent,
        productCurrency,
        planType,
        billingPeriodDays,
        frequency: frequency || null,
      }),
      subscriptionId ? 'subscription' : 'one-time',
      'whop',
      'pending',
      basketId,
      payToken,        // custom_str1 = our token
      locationId,      // custom_str2 = locationId
      ghlTransactionId, // custom_str3 = CRM transaction ID
    ]
  );

  const result = await createWhopCheckout({
    config: {
      apiKey: inst.whop_api_key!,
      companyId: inst.whop_company_id!,
      exchangeRate: rate,
      feePercent,
    },
    usdAmount,
    planType,
    billingPeriodDays,
    metadata: {
      basketId,
      woo_order_id: basketId, // back-compat key name from the WooCommerce plugin
      location_id: locationId,
      ghl_transaction_id: ghlTransactionId || '',
      customer_email: email,
      pkr_total: String(pkrTotal),
      usd_charged: String(usdAmount),
      plan_type: planType,
      billing_period_days: billingPeriodDays != null ? String(billingPeriodDays) : '',
      app_url: appUrl,
    },
  });

  if (!result.ok || !result.checkoutUrl) {
    await query(
      `UPDATE payments SET status = 'failed', raw_itn = ? WHERE pf_token = ? AND location_id = ?`,
      [JSON.stringify({ error: result.error, status: result.status, raw: result.raw }), basketId, locationId]
    );
    return NextResponse.json({
      error: result.error || 'Could not create Whop checkout.',
    }, { status: 502 });
  }

  await query(
    `UPDATE payments SET whop_checkout_id = ?, whop_plan_id = ? WHERE pf_token = ? AND location_id = ?`,
    [result.checkoutId || null, result.planId || null, basketId, locationId]
  );

  return NextResponse.json({
    provider: 'whop',
    redirectUrl: result.checkoutUrl,
    payToken,
    basketId,
    usdAmount,
  });
}
