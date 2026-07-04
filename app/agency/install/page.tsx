import Link from 'next/link';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function AgencyInstallPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const session = await getSession();
  if (session?.installMode === 'agency') {
    redirect('/agency');
  }
  if (session?.installMode === 'subaccount') {
    redirect('/dashboard');
  }

  const sp = searchParams ? await searchParams : {};
  const error = sp.error ? decodeURIComponent(sp.error) : '';
  const locationId = 'locationId' in sp && typeof sp.locationId === 'string' ? sp.locationId : ('location_id' in sp && typeof sp.location_id === 'string' ? sp.location_id : '');
  const companyId = 'companyId' in sp && typeof sp.companyId === 'string' ? sp.companyId : ('company_id' in sp && typeof sp.company_id === 'string' ? sp.company_id : '');

  if (locationId || companyId) {
    const params = new URLSearchParams({ mode: 'agency' });
    if (locationId) params.set('locationId', locationId);
    if (companyId) params.set('companyId', companyId);
    redirect(`/auth/launch?${params.toString()}`);
  }

  const headerStore = await headers();
  const proto = headerStore.get('x-forwarded-proto') || 'https';
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host') || 'localhost:3000';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
  const clientId = process.env.AGENCY_GHL_CLIENT_ID || '';
  const redirectUrl = `${appUrl}/agency/oauth/callback`;

  const scopes = [
    'contacts.readonly',
    'contacts.write',
    'opportunities.readonly',
    'opportunities.write',
    'locations.readonly',
    'payments.readonly',
    'payments.write',
  ].join(' ');

  const oauthUrl =
    `https://marketplace.gohighlevel.com/oauth/chooselocation` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
    `&scope=${encodeURIComponent(scopes)}`;

  return (
    <div className="page-shell-dark" style={{ display: 'flex', flexDirection: 'column' }}>
      <nav className="page-nav" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/agency" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: 'var(--blue)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13H11L10 22L19.5 11H13L13 2Z"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16 }}>GoPayFast Agency</div>
            <div style={{ fontSize: 11, color: 'var(--gray)' }}>10x Digital Ventures</div>
          </div>
        </Link>
      </nav>

      <main style={{ position: 'relative', zIndex: 1, flex: 1, display: 'grid', placeItems: 'center', padding: '40px 20px' }}>
        <div className="mobile-stack-2" style={{ width: '100%', maxWidth: 1120 }}>
          <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 24, padding: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,82,255,0.12)', border: '1px solid rgba(0,82,255,0.22)', borderRadius: 999, padding: '7px 12px', color: '#7FB0FF', fontSize: 12, fontWeight: 700, marginBottom: 18 }}>
              Agency Install
            </div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 34, fontWeight: 800, lineHeight: 1.05, marginBottom: 12 }}>Connect GoPayFast Agency App</div>
            <p style={{ color: 'var(--gray)', fontSize: 15, lineHeight: 1.8, maxWidth: 640 }}>
              This install path is for the agency-facing marketplace app. Use it for billing control, revenue operations, and managing the agency-side PayFast connection before subscriptions go live.
            </p>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 16, marginBottom: 20, color: '#F87171', fontSize: 13, lineHeight: 1.6 }}>
                Agency install failed: {error}
              </div>
            )}

            {!clientId && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: 16, marginBottom: 20, color: '#FBBF24', fontSize: 13, lineHeight: 1.6 }}>
                Missing agency OAuth client id. Set `AGENCY_GHL_CLIENT_ID` on the server.
              </div>
            )}

            <div className="mobile-stack-2" style={{ marginBottom: 24 }}>
              {['Agency billing dashboard', 'Client subscription oversight', 'Agency credential management', 'Revenue and suspension controls'].map((text) => (
                <div key={text} style={{ padding: 16, background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 14, fontSize: 13, lineHeight: 1.6 }}>{text}</div>
              ))}
            </div>

            <div style={{ color: 'var(--gray)', fontSize: 12, lineHeight: 1.7, marginBottom: 20 }}>
              This flow must use the agency GHL OAuth app credentials only. If `GHL_CLIENT_ID` or `GHL_CLIENT_SECRET` are being reused here, GHL will reject the token exchange with `Invalid client credentials`.
            </div>

            <a href={oauthUrl} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'var(--blue)', color: 'white', padding: '15px', borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
              Connect Agency App
            </a>
          </div>

          <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Before you connect</div>
            <div style={{ display: 'grid', gap: 12, color: 'var(--gray)', fontSize: 13, lineHeight: 1.7 }}>
              <div>1. Confirm the agency PayFast credentials are ready.</div>
              <div>2. Keep admin access separate at `/admin`.</div>
              <div>3. Use this app only for agency-side billing operations.</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
