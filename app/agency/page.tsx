import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getAgencySettings } from '@/lib/billing';
import { getBalance } from '@/lib/wallet';
import { getPaymentInstruments } from '@/lib/payment-instruments';
import AgencyDashboardClient from './AgencyDashboardClient';

export default async function AgencyPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession();
  if (!session) redirect('/agency/install');
  if (session.installMode !== 'agency') redirect('/dashboard');

  const sp = searchParams ? await searchParams : {};
  const installed = sp.installed === '1';
  const restored = sp.restored === '1';
  const agencySettings = await getAgencySettings();
  const payfastReady = Boolean(agencySettings?.merchant_id && agencySettings?.merchant_key);
  const wallet = await getBalance(session.locationId);
  const instruments = await getPaymentInstruments(session.locationId);
  const invoices = await query<any[]>(
    `SELECT bi.*, ap.name AS plan_name
     FROM billing_invoices bi
     LEFT JOIN agency_plans ap ON ap.id = bi.plan_id
     WHERE bi.location_id = ?
     ORDER BY bi.created_at DESC
     LIMIT 12`,
    [session.locationId]
  );

  const subaccounts = await query<any[]>(
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
       SELECT bi2.id FROM billing_invoices bi2 WHERE bi2.location_id = i.location_id ORDER BY bi2.created_at DESC LIMIT 1
     )
     ORDER BY COALESCE(ma.business_name, i.merchant_name, i.location_id) ASC`
  );

  const stats = await query<any[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END),0) AS mrr,
       SUM(status = 'active') AS active_count,
       SUM(status = 'trial') AS trial_count,
       SUM(status = 'suspended') AS suspended_count
     FROM location_subscriptions`
  );

  return <AgencyDashboardClient stats={stats[0] || { mrr: 0, active_count: 0, trial_count: 0, suspended_count: 0 }} sessionLocationId={session.locationId} installed={installed} restored={restored} payfastReady={payfastReady} wallet={wallet} instruments={instruments} invoices={invoices} agencySettings={agencySettings} subaccounts={subaccounts} />;
}
