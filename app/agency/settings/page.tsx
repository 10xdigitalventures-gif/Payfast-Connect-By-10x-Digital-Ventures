import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AgencyPayfastSettings from '../AgencyPayfastSettings';

export default async function AgencySettingsPage() {
  const session = await getSession();
  if (!session) redirect('/agency/login');
  if (session.installMode !== 'agency') redirect('/dashboard');

  return (
    <div className="page-shell-dark" style={{ padding: '28px 24px 40px' }}>
      <div className="page-container" style={{ maxWidth: 1120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,82,255,0.12)', border: '1px solid rgba(0,82,255,0.22)', borderRadius: 999, padding: '7px 12px', color: '#7FB0FF', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
              Agency PayFast Setup
            </div>
            <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 34, fontWeight: 800, lineHeight: 1.05, marginBottom: 8 }}>Settings</h1>
            <p style={{ color: 'var(--gray)', fontSize: 15, lineHeight: 1.75 }}>
              Manage agency PayFast credentials and legal URLs from a dedicated page.
            </p>
          </div>
          <Link href="/agency" style={{ background: 'var(--blue)', color: 'white', textDecoration: 'none', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
            Back to Agency Dashboard
          </Link>
        </div>

        <AgencyPayfastSettings />
      </div>
    </div>
  );
}
