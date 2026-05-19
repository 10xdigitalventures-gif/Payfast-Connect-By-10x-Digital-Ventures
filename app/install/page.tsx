import Link from 'next/link';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function InstallPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession();
  if (session?.installMode === 'agency') {
    redirect('/agency');
  }
  if (session?.installMode === 'subaccount') {
    redirect('/dashboard');
  }

  const sp = searchParams ? await searchParams : {};
  const locationId = typeof sp.locationId === 'string' ? sp.locationId : (typeof sp.location_id === 'string' ? sp.location_id : '');
  const companyId = typeof sp.companyId === 'string' ? sp.companyId : (typeof sp.company_id === 'string' ? sp.company_id : '');

  if (locationId || companyId) {
    const params = new URLSearchParams({ mode: 'subaccount' });
    if (locationId) params.set('locationId', locationId);
    if (companyId) params.set('companyId', companyId);
    redirect(`/auth/launch?${params.toString()}`);
  }

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL!;
  const clientId  = process.env.GHL_CLIENT_ID!;
  const redirectUrl  = `${appUrl}/oauth/callback`;

  const scopes = [
    'payments/orders.readonly',
    'payments/orders.write',
    'payments/transactions.readonly',
    'payments/subscriptions.readonly',
    'payments/custom-provider.readonly',
    'payments/custom-provider.write',
    'products.readonly',
    'products/prices.readonly',
    'contacts.readonly',
    'locations.readonly',
    'oauth.readonly',
    'oauth.write',
  ].join(' ');

  const oauthUrl =
    `https://marketplace.gohighlevel.com/oauth/chooselocation` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
    `&scope=${encodeURIComponent(scopes)}`;

  return (
    <div className="page-shell-dark" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* BG Glow */}
      <div style={{ position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)', width: 1000, height: 700, background: 'radial-gradient(ellipse,rgba(0,82,255,0.15) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Nav */}
      <nav className="page-nav" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: 'var(--blue)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13H11L10 22L19.5 11H13L13 2Z"/></svg>
          </div>
          <div>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16 }}>GoPayFast Connect</div>
            <div style={{ fontSize: 11, color: 'var(--gray)' }}>by 10x Digital Ventures</div>
          </div>
        </Link>
        <Link href="/" style={{ color: 'var(--gray)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to Home
        </Link>
      </nav>

      {/* Card */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 24, padding: 24, width: '100%', maxWidth: 520 }}>
          {/* Logos */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, background: 'var(--blue)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13H11L10 22L19.5 11H13L13 2Z"/></svg>
              </div>
              <span style={{ color: 'var(--gray)', fontSize: 22 }}>⇄</span>
              <div style={{ width: 56, height: 56, background: '#FF6B2C', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 14 }}>
                CRM
              </div>
            </div>
            <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
              Connect GoPayFast to CRM
            </h1>
            <p style={{ color: 'var(--gray)', fontSize: 14, lineHeight: 1.6 }}>
              Authorize this app to connect your GoPayFast merchant account with your CRM sub-account.
            </p>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
            <div style={{ width: 24, height: 8, borderRadius: 4, background: 'var(--success)' }} />
            <div style={{ width: 24, height: 8, borderRadius: 4, background: 'var(--blue)' }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--dark3)' }} />
          </div>

          {/* Permissions */}
          <div style={{ background: 'var(--dark3)', borderRadius: 12, padding: 20, marginBottom: 28 }}>
            <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 14, fontWeight: 500 }}>
              This app will access your CRM account to:
            </div>
            {[
              { icon: '👤', text: 'Read and update contact records' },
              { icon: '📊', text: 'Move opportunities in your pipeline' },
              { icon: '🏷️', text: 'Add and remove contact tags' },
              { icon: '⚡', text: 'Trigger automation workflows' },
            ].map((p) => (
              <div key={p.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '7px 0' }}>
                <div style={{ width: 22, height: 22, background: 'rgba(0,82,255,0.15)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>
                  {p.icon}
                </div>
                {p.text}
              </div>
            ))}
          </div>

          {/* OAuth Button */}
          <a href={oauthUrl} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', background: 'var(--blue)', color: 'white',
            padding: '15px', borderRadius: 10, fontSize: 15, fontWeight: 500,
            transition: 'background .2s',
          }}>
            <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            Connect &amp; Authorize with CRM
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 16, fontSize: 12, color: 'var(--gray)' }}>
            <div style={{ width: 6, height: 6, background: 'var(--success)', borderRadius: '50%' }} />
            256-bit encrypted · Credentials stored securely · Never shared
          </div>
        </div>
      </main>
    </div>
  );
}
