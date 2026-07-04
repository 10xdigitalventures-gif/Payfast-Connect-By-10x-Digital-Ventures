import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getLocationSubscription, checkSubscription, getAgencySettings } from '@/lib/billing';
import { query } from '@/lib/db';
import Sidebar from '@/components/Sidebar';
import BillingWalletCards from '@/components/BillingWalletCards';
import { getBalance } from '@/lib/wallet';
import { getPaymentInstruments } from '@/lib/payment-instruments';

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect('/install');

  const status = await checkSubscription(session.locationId);
  const subscription = await getLocationSubscription(session.locationId);
  const agencySettings = await getAgencySettings();
  const payfastReady = Boolean(agencySettings?.merchant_id && agencySettings?.merchant_key);
  const invoices = await query<any[]>(
    `SELECT bi.*, ap.name AS plan_name FROM billing_invoices bi LEFT JOIN agency_plans ap ON ap.id = bi.plan_id WHERE bi.location_id = ? ORDER BY bi.created_at DESC`,
    [session.locationId]
  );
  const wallet = await getBalance(session.locationId);
  const instruments = await getPaymentInstruments(session.locationId);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="resp-padding" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700 }}>Billing</h2>
          <p style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>Manage your current plan, billing cycle, and invoice history.</p>
        </div>
        <div className="resp-padding mobile-stack-2">
          <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Current Plan</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 28, fontFamily: 'var(--font-head)', color: '#3D7FFF' }}>{subscription?.plan_name || 'Trial'}</div>
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(0,82,255,0.1)', color: '#3D7FFF', textTransform: 'capitalize' }}>{status.status}</span>
            </div>
            {status.status === 'trial' && <div style={{ fontSize: 14, color: 'var(--warning)', marginBottom: 10 }}>Trial ends in {status.trialDaysLeft} day(s)</div>}
            {status.currentPeriodEnd && <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 18 }}>Next billing date: {new Date(status.currentPeriodEnd).toLocaleDateString()}</div>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="/billing/plans" style={{ background: 'var(--blue)', color: 'white', padding: '10px 16px', borderRadius: 10, fontSize: 13, textDecoration: 'none' }}>Upgrade / Downgrade</a>
              <form action="/api/billing/cancel" method="POST"><button type="submit" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--gray)', padding: '10px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>Cancel Subscription</button></form>
            </div>
          </div>
          <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Billing Status</div>
            <div style={{ fontSize: 13, color: 'var(--gray)', lineHeight: 1.7 }}>
              <div>Status: <strong style={{ color: 'white', textTransform: 'capitalize' }}>{status.status}</strong></div>
              <div>Needs plan selection: <strong style={{ color: 'white' }}>{status.needsPlanSelection ? 'Yes' : 'No'}</strong></div>
              <div>Suspended: <strong style={{ color: 'white' }}>{status.isSuspended ? 'Yes' : 'No'}</strong></div>
            </div>
          </div>
        </div>
        {!payfastReady && (
          <div style={{ margin: '0 32px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 12, padding: '14px 18px', color: '#F87171', fontSize: 13, lineHeight: 1.7 }}>
            PayFast credentials are not connected yet. Card saving and agency payment collection stay locked until agency PayFast setup is completed.
          </div>
        )}
        <div style={{ padding: '0 32px 32px' }}>
          <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Billing History</div>
            <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 760, display: 'grid', gap: 10 }}>
              {invoices.length === 0 ? <div style={{ color: 'var(--gray)' }}>No billing invoices yet.</div> : invoices.map((invoice) => (
                <div key={invoice.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 120px 140px 120px', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 13, minWidth: 620 }}>
                  <div>{invoice.plan_name || 'Plan'}<div style={{ color: 'var(--gray)', fontSize: 12 }}>{new Date(invoice.created_at).toLocaleString()}</div></div>
                  <div>PKR {Number(invoice.amount).toLocaleString()}</div>
                  <div>{invoice.period_start ? `${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}` : 'Pending period'}</div>
                  <div style={{ textTransform: 'capitalize' }}>{invoice.status}</div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
        <BillingWalletCards wallet={wallet} instruments={instruments} payfastReady={payfastReady} />
      </div>
    </div>
  );
}
