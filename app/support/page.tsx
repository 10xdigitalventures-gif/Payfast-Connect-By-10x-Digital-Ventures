export default function SupportPage() {
  return (
    <div className="page-shell-dark" style={{ padding: '36px 20px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <div className="page-container">
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 34, fontWeight: 800, marginBottom: 8 }}>Support</div>
          <div style={{ color: '#8AA0C8' }}>Use the channels below for deployment, onboarding, or payment gateway support.</div>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <a href="mailto:support@10xdigitalventures.com?subject=GoPayFast%20Connect%20Support" style={{ background:'rgba(12, 22, 48, 0.88)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:18, textDecoration:'none', color:'white' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Email Support</div>
            <div style={{ color: '#8AA0C8', fontSize: 13 }}>support@10xdigitalventures.com</div>
          </a>
          <a href="https://wa.me/923202900295" target="_blank" style={{ background:'rgba(12, 22, 48, 0.88)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:18, textDecoration:'none', color:'white' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>WhatsApp Support</div>
            <div style={{ color: '#8AA0C8', fontSize: 13, marginBottom: 4 }}>Open support chat on WhatsApp</div>
            <div style={{ color: 'white', fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>+92 320 2900295</div>
          </a>
        </div>
      </div>
    </div>
  );
}
