export default function BillingSuspendedPage() {
  return (
    <div className="page-shell-dark" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 560, width: '100%', background: 'var(--dark2)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 18, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>⚠️</div>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 30, marginBottom: 10 }}>Your account is suspended</h1>
        <p style={{ color: '#8A9BC0', lineHeight: 1.7, marginBottom: 24 }}>Your billing trial expired or a payment was not completed. Complete billing to restore access immediately.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/billing/plans" style={{ background: '#0052FF', color: 'white', padding: '12px 18px', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>Pay Now</a>
          <a href="mailto:support@10xdigitalventures.com" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '12px 18px', borderRadius: 10, textDecoration: 'none' }}>Contact Support</a>
        </div>
      </div>
    </div>
  );
}
