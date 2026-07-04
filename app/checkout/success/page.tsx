// ═══ app/checkout/success/page.tsx ═══
export default function GHLCheckoutSuccess() {
  return (
    <div style={{ minHeight:'100vh', background:'white', display:'grid', placeItems:'center', fontFamily:'DM Sans, sans-serif' }}>
      <script dangerouslySetInnerHTML={{__html:`
        // Notify CRM parent frame payment succeeded
        window.parent.postMessage({ type: 'payment-success' }, '*');
      `}} />
      <div style={{ textAlign:'center', padding:24 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
        <h2 style={{ fontFamily:'var(--font-head)', fontSize:22, fontWeight:700, color:'#0F172A', marginBottom:8 }}>Payment Successful!</h2>
        <p style={{ color:'#64748B', fontSize:14 }}>Your payment has been received. This window will close shortly.</p>
      </div>
    </div>
  );
}
