import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { query, Installation } from '@/lib/db';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession();
  if (!session) redirect('/install');
  if (session.installMode === 'agency') redirect('/agency');

  const sp = searchParams ? await searchParams : {};
  const restored = sp.restored === '1';

  const { locationId } = session;

  const [inst] = await query<Installation[]>(
    'SELECT * FROM installations WHERE location_id = ?',
    [locationId]
  );

  const credsMissing = !inst?.merchant_id || !inst?.merchant_key;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {/* Topbar */}
          <div className="resp-padding" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700 }}>CRM Dashboard</h2>
              <p style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>
                {inst?.environment === 'sandbox' ? '🟡 Sandbox Mode' : '🟢 Live Mode'} · CRM manages payments directly
              </p>
            </div>
            <Link href="/settings" style={{ background: 'var(--blue)', color: 'white', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
              Open Settings
            </Link>
          </div>

            <div className="resp-padding">

          {restored && (
            <div style={{ background: 'rgba(0,82,255,0.08)', border: '1px solid rgba(0,82,255,0.2)', borderRadius: 12, padding: '14px 20px', marginBottom: 24, color: '#7FB0FF', fontSize: 14 }}>
               Existing sub-account session restored successfully.
            </div>
          )}

          {/* Credentials warning */}
          {credsMissing && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
               <span style={{ fontSize: 14, color: 'var(--warning)' }}>⚠️ GoPayFast credentials not configured — CRM payment sync is not active yet.</span>
               <Link href="/settings" style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 600 }}>Go to Settings →</Link>
            </div>
          )}

          <div className="resp-grid-auto" style={{ marginBottom: 24 }}>
            {[
              { label: 'CRM Connection', value: inst ? 'Connected' : 'Not connected', color: inst ? 'var(--success)' : 'var(--warning)' },
              { label: 'Location ID', value: locationId, color: 'white' },
              { label: 'Mode', value: inst?.environment === 'sandbox' ? 'Sandbox' : 'Live', color: 'var(--blue-light)' },
              { label: 'Sync State', value: credsMissing ? 'Needs setup' : 'Ready', color: credsMissing ? 'var(--warning)' : 'var(--success)' },
            ].map(c => (
              <div key={c.label} style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
                <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 10 }}>{c.label}</div>
                <div title={c.label === 'Location ID' ? locationId : undefined} style={{
                  fontFamily: c.label === 'Location ID' ? 'monospace' : 'var(--font-head)',
                  fontSize: c.label === 'Location ID' ? 14 : 28,
                  fontWeight: 700,
                  color: c.color,
                  lineHeight: 1.4,
                  wordBreak: c.label === 'Location ID' ? 'break-all' : 'normal',
                  overflowWrap: c.label === 'Location ID' ? 'anywhere' : 'normal',
                  userSelect: 'text',
                }}>
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>CRM-first workflow</div>
            <div style={{ color: 'var(--gray)', fontSize: 13, lineHeight: 1.8 }}>
              Payments, links, invoices, and recurring actions should be handled inside your CRM.
              This app now acts as the connector for install, settings, and webhook configuration only.
            </div>
          </div>

          {/* ITN Webhook info */}
          <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Your GoPayFast ITN Webhook URL</div>
            <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 12 }}>
              Add this URL in your GoPayFast dashboard as the payment callback / notification URL.
            </div>
            <div style={{ background: 'var(--dark3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <code style={{ fontSize: 13, color: 'var(--blue-light)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {process.env.NEXT_PUBLIC_APP_URL}/api/payfast/itn
              </code>
              <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.1)', color: 'var(--success)', padding: '3px 10px', borderRadius: 6 }}>Active</span>
            </div>
          </div>

        </div>
      </div>
    </div>

  );
}
