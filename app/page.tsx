import Link from 'next/link';
import { getSession } from '@/lib/session';

const card = {
  background: 'rgba(12, 22, 48, 0.88)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  padding: 24,
} as const;

export default async function RootPage() {
  const session = await getSession();

  return (
    <div className="page-shell-dark">
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 15% 15%, rgba(0,82,255,0.16), transparent 25%), radial-gradient(circle at 85% 10%, rgba(255,107,44,0.12), transparent 22%)' }} />

      <nav className="page-nav" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'white', textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, background: '#0052FF', borderRadius: 10, display: 'grid', placeItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13H11L10 22L19.5 11H13L13 2Z" /></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 800, lineHeight: 1 }}>GoPayFast Connect</div>
            <div style={{ fontSize: 11, color: '#8AA0C8' }}>Aggregator Portal by 10x Digital Ventures</div>
          </div>
        </Link>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
           <Link href="/apply" style={{ color: '#DCE7FF', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Apply</Link>
           <Link href="/docs" style={{ color: '#DCE7FF', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Docs</Link>
           <Link href="/support" style={{ color: '#DCE7FF', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Support</Link>
           {session && (
             <Link href={session.installMode === 'agency' ? '/agency' : '/dashboard'} style={{ background: '#0052FF', color: 'white', textDecoration: 'none', padding: '9px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
               Open {session.installMode === 'agency' ? 'Agency Dashboard' : 'CRM Dashboard'}
             </Link>
           )}
         </div>
      </nav>

      <main className="page-container" style={{ position: 'relative', zIndex: 1, padding: '56px 24px 72px' }}>
        <section className="mobile-stack-2" style={{ alignItems: 'stretch', marginBottom: 28 }}>
          <div style={{ ...card, padding: 34 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,82,255,0.12)', color: '#7FB0FF', border: '1px solid rgba(0,82,255,0.2)', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 700, marginBottom: 18 }}>
              GoPayFast Aggregator Platform
            </div>
            <h1 className="home-hero-title" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 48, lineHeight: 1.05, fontWeight: 800, marginBottom: 16 }}>Onboard merchants, connect CRM accounts, and manage agency billing from one place.</h1>
            <p style={{ color: '#8AA0C8', fontSize: 16, lineHeight: 1.8, maxWidth: 720, marginBottom: 24 }}>
              This portal is built for payment aggregation. Merchant applications go through the onboarding form, CRM sub-accounts use the install flow, and agencies use the agency install or dashboard depending on whether they are already connected.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/apply" style={{ background: '#0052FF', color: 'white', textDecoration: 'none', padding: '11px 15px', borderRadius: 12, fontWeight: 700, fontSize: 13 }}>Merchant Application Form</Link>
              <Link href="/install" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'white', textDecoration: 'none', padding: '11px 15px', borderRadius: 12, fontWeight: 700, fontSize: 13 }}>CRM Sub-Account Install</Link>
              <Link href={session?.installMode === 'agency' ? '/agency' : '/agency/install'} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'white', textDecoration: 'none', padding: '11px 15px', borderRadius: 12, fontWeight: 700, fontSize: 13 }}>
                {session?.installMode === 'agency' ? 'Open Agency Dashboard' : 'Agency App Connect'}
              </Link>
            </div>
          </div>

          <div style={{ ...card, padding: 26, display: 'grid', gap: 14 }}>
            {[
              ['Merchant Applications', 'Use the application form to collect onboarding, business, and banking details.'],
              ['Sub-Account CRM App', 'Keep each client location isolated and connected to its own CRM session.'],
              ['Agency SaaS Controls', 'Use the agency app to manage onboarding and location-level access.'],
            ].map(([title, desc]) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{title}</div>
                <div style={{ color: '#8AA0C8', fontSize: 13, lineHeight: 1.7 }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="resp-grid-auto" style={{ marginBottom: 28 }}>
            {[
              ['/apply', 'Merchant Application', 'For merchants that need onboarding, business, and banking details collected.'],
              ['/install', 'CRM Sub-Account Install', 'For client CRM users who need the payment dashboard and tools.'],
              [session?.installMode === 'agency' ? '/agency' : '/agency/install', 'Agency Dashboard / Install', 'For agency users. Installed agencies open the dashboard, new agencies start the install flow.'],
              ['/support', 'Support', 'Need help with onboarding, deployment, or payments? Start here.'],
            ].map(([href, title, desc]) => (
            <Link key={href} href={href} style={{ ...card, textDecoration: 'none', color: 'white' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 800, marginBottom: 10 }}>{title}</div>
              <div style={{ color: '#8AA0C8', fontSize: 13, lineHeight: 1.7 }}>{desc}</div>
            </Link>
          ))}
        </section>

        <section style={{ background: 'rgba(0,82,255,0.05)', border: '1px solid rgba(0,82,255,0.1)', borderRadius: 32, padding: 48, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 32, fontWeight: 800, marginBottom: 48 }}>How It Works</h2>
          <div className="resp-grid-auto" style={{ gap: 32, position: 'relative' }}>
            {[
              ['Onboard', 'Merchants apply via the portal and undergo KYC verification.', '01'],
              ['Connect', 'Sub-accounts connect their CRM instance so payments stay isolated by location.', '02'],
              ['Scale', 'Agencies manage each location independently from the CRM side.', '03'],
            ].map(([title, desc, step]) => (
              <div key={title} style={{ position: 'relative' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 64, fontWeight: 800, color: 'rgba(0,82,255,0.1)', position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', zIndex: 0 }}>{step}</div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{title}</div>
                  <div style={{ color: '#8AA0C8', fontSize: 15, lineHeight: 1.6 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
