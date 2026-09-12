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
  const agencySettings = await getAgencySettings();
  const environment = agencySettings?.environment === 'sandbox' ? 'sandbox' : 'live';
  const provider = String(agencySettings?.route_subscription || 'payfast');
  const gatewayReady = provider === 'swich'
    ? Boolean(environment === 'sandbox' ? agencySettings?.swich_sandbox_client_id && agencySettings?.swich_sandbox_secret_key && agencySettings?.swich_sandbox_checkout_url : agencySettings?.swich_live_client_id && agencySettings?.swich_live_secret_key && agencySettings?.swich_live_checkout_url)
    : provider === 'whop'
      ? Boolean(agencySettings?.whop_api_key && agencySettings?.whop_company_id)
      : Boolean(environment === 'sandbox' ? agencySettings?.sandbox_merchant_id && agencySettings?.sandbox_merchant_key : agencySettings?.merchant_id && agencySettings?.merchant_key);

  const agencyRows = await query<any[]>('SELECT company_id FROM installations WHERE location_id=? LIMIT 1', [session.locationId]);
  const companyId = agencyRows[0]?.company_id;
  if (!companyId) redirect('/agency/onboard?error=missing_company');

  const [wallet, instruments, invoices, rawSubaccounts, stats] = await Promise.all([
    getBalance(session.locationId),
    getPaymentInstruments(session.locationId),
    query<any[]>(`SELECT bi.*, ap.name AS plan_name FROM billing_invoices bi LEFT JOIN agency_plans ap ON ap.id=bi.plan_id WHERE bi.location_id=? ORDER BY bi.created_at DESC LIMIT 12`, [session.locationId]),
    query<any[]>(`SELECT i.location_id,i.merchant_name,ma.business_name,ls.id AS subscription_id,ls.status AS subscription_status,ls.amount AS resell_amount,
      ls.trial_ends_at,ls.current_period_end,ls.current_period_start,ls.plan_id,ap.name AS plan_name,ap.price_monthly,ap.price_yearly,ap.max_locations,
      w.balance AS wallet_balance,w.currency AS wallet_currency,bi_last.status AS last_invoice_status,bi_last.amount AS last_invoice_amount,bi_last.created_at AS last_invoice_at
      FROM installations i LEFT JOIN merchant_applications ma ON ma.ghl_location_id=i.location_id LEFT JOIN location_subscriptions ls ON ls.location_id=i.location_id
      LEFT JOIN agency_plans ap ON ap.id=ls.plan_id LEFT JOIN wallets w ON w.location_id=i.location_id LEFT JOIN billing_invoices bi_last ON bi_last.id=(SELECT bi2.id FROM billing_invoices bi2 WHERE bi2.location_id=i.location_id ORDER BY bi2.created_at DESC LIMIT 1)
      WHERE i.company_id=? ORDER BY COALESCE(ma.business_name,i.merchant_name,i.location_id) ASC`, [companyId]),
    query<any[]>(`SELECT COALESCE(SUM(CASE WHEN ls.status='active' THEN ls.amount ELSE 0 END),0) AS mrr,
      SUM(ls.status='active') AS active_count,SUM(ls.status='trial') AS trial_count,SUM(ls.status='suspended') AS suspended_count,SUM(ls.status='past_due') AS past_due_count
      FROM location_subscriptions ls JOIN installations i ON i.location_id=ls.location_id WHERE i.company_id=?`, [companyId]),
  ]);

  const subaccounts = rawSubaccounts.map((row) => ({ locationId: row.location_id, businessName: row.business_name || '', merchantName: row.merchant_name || '',
    status: row.subscription_status || '', planId: row.plan_id, planName: row.plan_name || '', priceMonthly: Number(row.price_monthly || 0),
    priceYearly: Number(row.price_yearly || 0), maxLocations: Number(row.max_locations || 0), resellAmount: Number(row.resell_amount || 0),
    subscriptionId: row.subscription_id, trialEndsAt: row.trial_ends_at, currentPeriodEnd: row.current_period_end, currentPeriodStart: row.current_period_start,
    walletBalance: Number(row.wallet_balance || 0), walletCurrency: row.wallet_currency || 'PKR', lastInvoiceStatus: row.last_invoice_status || '',
    lastInvoiceAmount: Number(row.last_invoice_amount || 0), lastInvoiceAt: row.last_invoice_at }));

  return <AgencyDashboardClient stats={stats[0] || {}} sessionLocationId={session.locationId} installed={sp.installed === '1'} restored={sp.restored === '1'}
    payfastReady={gatewayReady} wallet={wallet} instruments={instruments} invoices={invoices} agencySettings={agencySettings} subaccounts={subaccounts} />;
}
