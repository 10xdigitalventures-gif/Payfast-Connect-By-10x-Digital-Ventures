import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.installMode !== 'agency') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await query<any[]>(
    `SELECT
       i.location_id,
       i.merchant_name,
       ma.business_name,
       ls.id AS subscription_id,
       ls.status AS subscription_status,
       ls.amount AS resell_amount,
       ls.trial_ends_at,
       ls.current_period_end,
       ls.current_period_start,
       ls.plan_id,
       ap.name AS plan_name,
       ap.price_monthly,
       ap.price_yearly,
       ap.max_locations,
       w.balance AS wallet_balance,
       w.currency AS wallet_currency,
       bi_last.status AS last_invoice_status,
       bi_last.amount AS last_invoice_amount,
       bi_last.created_at AS last_invoice_at
     FROM installations i
     LEFT JOIN merchant_applications ma ON ma.ghl_location_id = i.location_id
     LEFT JOIN location_subscriptions ls ON ls.location_id = i.location_id
     LEFT JOIN agency_plans ap ON ap.id = ls.plan_id
     LEFT JOIN wallets w ON w.location_id = i.location_id
     LEFT JOIN billing_invoices bi_last ON bi_last.id = (
       SELECT bi2.id
       FROM billing_invoices bi2
       WHERE bi2.location_id = i.location_id
       ORDER BY bi2.created_at DESC
       LIMIT 1
     )
     ORDER BY COALESCE(ma.business_name, i.merchant_name, i.location_id) ASC`
  );

  return NextResponse.json(
    rows.map((row) => ({
      locationId: row.location_id,
      businessName: row.business_name || '',
      merchantName: row.merchant_name || '',
      status: row.subscription_status || 'none',
      planId: row.plan_id || null,
      planName: row.plan_name || 'Trial',
      priceMonthly: Number(row.price_monthly || 0),
      priceYearly: Number(row.price_yearly || 0),
      maxLocations: Number(row.max_locations || 0),
      resellAmount: Number(row.resell_amount || 0),
      subscriptionId: row.subscription_id || null,
      trialEndsAt: row.trial_ends_at || null,
      currentPeriodEnd: row.current_period_end || null,
      currentPeriodStart: row.current_period_start || null,
      walletBalance: Number(row.wallet_balance || 0),
      walletCurrency: row.wallet_currency || 'PKR',
      lastInvoiceStatus: row.last_invoice_status || '',
      lastInvoiceAmount: Number(row.last_invoice_amount || 0),
      lastInvoiceAt: row.last_invoice_at || null,
    }))
  );
}
