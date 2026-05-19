// ═══ app/pay/success/page.tsx ═══
export default function PaySuccessPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#050A1A', display:'grid', placeItems:'center', fontFamily:'DM Sans, sans-serif', color:'white', padding:24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ textAlign:'center', maxWidth:460 }}>
        <div style={{ width:80, height:80, background:'rgba(34,197,94,0.1)', border:'2px solid rgba(34,197,94,0.3)', borderRadius:'50%', display:'grid', placeItems:'center', margin:'0 auto 24px', fontSize:36 }}>✅</div>
        <h1 style={{ fontFamily:'var(--font-head)', fontSize:28, fontWeight:800, marginBottom:12 }}>Payment Successful!</h1>
        <p style={{ color:'#8A9BC0', lineHeight:1.6, marginBottom:8 }}>Thank you! Your payment has been received and confirmed.</p>
        <p style={{ color:'#8A9BC0', fontSize:13 }}>A confirmation email will be sent to your inbox shortly.</p>
        <div style={{ marginTop:28, padding:'14px 20px', background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:12, fontSize:13, color:'#22C55E' }}>
          🔒 Secured by GoPayFast · 10x Digital Ventures
        </div>
      </div>
    </div>
  );
}
