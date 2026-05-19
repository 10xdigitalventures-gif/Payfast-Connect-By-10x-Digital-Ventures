'use client';
import { useState } from 'react';
import { useEffect } from 'react';

interface Props {
  token:string; name:string; description:string; amount:string;
  isCustomAmount:boolean; isRecurring:boolean; interval:string;
  collectPhone:boolean; collectAddress:boolean; allowCoupon:boolean;
  locationId:string; prefilledEmail:string; prefilledName:string; prefilledPhone:string;
  merchantId:string; merchantKey:string; passphrase:string; environment:string; appUrl:string;
}

export default function PaymentPageClient(p:Props) {
  const [name,    setName]    = useState(p.prefilledName);
  const [email,   setEmail]   = useState(p.prefilledEmail);
  const [phone,   setPhone]   = useState(p.prefilledPhone);
  const [address, setAddress] = useState('');
  const [amount,  setAmount]  = useState(p.amount);
  const [coupon,  setCoupon]  = useState('');
  const [couponStatus, setCouponStatus] = useState<{valid:boolean;discount:number;msg:string}|null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [pfData,  setPfData]  = useState<{actionUrl:string;fields:Record<string,string>}|null>(null);

  useEffect(() => {
    if (!pfData) return;
    const form = document.getElementById('pfForm') as HTMLFormElement | null;
    if (form) {
      const timer = window.setTimeout(() => form.submit(), 200);
      return () => window.clearTimeout(timer);
    }
  }, [pfData]);

  const baseAmount = parseFloat(amount||'0');
  const discountAmt = couponStatus?.valid ? couponStatus.discount : 0;
  const finalAmount = Math.max(baseAmount - discountAmt, 0);

  const fmt = (n:number) => `PKR ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')}`;

  async function applyCoupon() {
    const res = await fetch(`/api/coupons/validate`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code:coupon, amount:baseAmount, location_id:p.locationId }) });
    const data = await res.json();
    if (data.valid) setCouponStatus({ valid:true, discount:data.discount_amount, msg:`✅ ${data.message}` });
    else setCouponStatus({ valid:false, discount:0, msg:`❌ ${data.message}` });
  }

  async function proceed() {
    if (!name.trim()||!email.includes('@')) { setError('Name and valid email required'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/pay/create', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        token: p.token, name_first: name.split(' ')[0], name_last: name.split(' ').slice(1).join(' ')||'.',
        email, phone, address, amount: finalAmount.toFixed(2),
        is_recurring: p.isRecurring, interval: p.interval,
        coupon_code: couponStatus?.valid ? coupon : null,
        custom_str2: p.locationId,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error||'Failed'); setLoading(false); return; }
    setPfData(data);
    setLoading(false);
  }

  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px 16px', color:'white', fontSize:14, outline:'none', fontFamily:'inherit', transition:'border-color .2s' } as const;

  // Auto-submit GoPayFast form
  if (pfData) {
    return (
      <div style={{ minHeight:'100vh', background:'#050A1A', display:'grid', placeItems:'center', fontFamily:'DM Sans, sans-serif' }}>
        <div style={{ textAlign:'center', color:'white' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>
          <p style={{ color:'#8A9BC0', marginBottom:20 }}>Redirecting to GoPayFast secure checkout…</p>
          <form id="pfForm" action={pfData.actionUrl} method="POST">
            {Object.entries(pfData.fields).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#050A1A', color:'white', fontFamily:'DM Sans, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:'#0052FF', borderRadius:8, display:'grid', placeItems:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13H11L10 22L19.5 11H13Z"/></svg>
          </div>
          <span style={{ fontFamily:'var(--font-head)', fontWeight:700, fontSize:14 }}>Secure Checkout</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#8A9BC0' }}>
          <span style={{ width:7, height:7, background:'#22C55E', borderRadius:'50%', display:'inline-block' }}></span>
          SSL Secured · GoPayFast
        </div>
      </div>

      <div style={{ maxWidth:480, margin:'0 auto', padding:'40px 24px' }}>
        {/* Product info */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:64, height:64, background:'rgba(0,82,255,0.1)', borderRadius:16, display:'grid', placeItems:'center', margin:'0 auto 16px', fontSize:28 }}>💳</div>
          <h1 style={{ fontFamily:'var(--font-head)', fontSize:24, fontWeight:700, marginBottom:8 }}>{p.name}</h1>
          {p.description && <p style={{ color:'#8A9BC0', fontSize:14, lineHeight:1.6 }}>{p.description}</p>}
          {p.isRecurring && <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.25)', color:'#A78BFA', padding:'5px 12px', borderRadius:20, fontSize:12, marginTop:10 }}>🔄 Recurring · {p.interval}</div>}
        </div>

        {/* Amount */}
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:24, marginBottom:24 }}>
          {p.isCustomAmount ? (
            <div>
              <label style={{ fontSize:13, color:'#8A9BC0', marginBottom:8, display:'block' }}>Enter Amount (PKR) *</label>
              <input style={{ ...inp, fontSize:22, fontWeight:600, textAlign:'center' }} type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" />
            </div>
          ) : (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:13, color:'#8A9BC0', marginBottom:6 }}>Amount Due</div>
              <div style={{ fontFamily:'var(--font-head)', fontSize:36, fontWeight:800, color:'#3D7FFF' }}>{fmt(baseAmount)}</div>
            </div>
          )}

          {/* Coupon */}
          {p.allowCoupon && (
            <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display:'flex', gap:8 }}>
                <input style={{ ...inp, flex:1 }} value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" />
                <button onClick={applyCoupon} style={{ background:'#0052FF', color:'white', border:'none', padding:'0 18px', borderRadius:10, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Apply</button>
              </div>
              {couponStatus && <div style={{ fontSize:12, marginTop:8, color: couponStatus.valid?'#22C55E':'var(--danger)' }}>{couponStatus.msg}</div>}
              {couponStatus?.valid && (
                <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#8A9BC0' }}><span>Original</span><span>{fmt(baseAmount)}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#22C55E' }}><span>Discount</span><span>-{fmt(discountAmt)}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:600, borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:8, marginTop:4 }}><span>Total</span><span style={{ color:'#3D7FFF' }}>{fmt(finalAmount)}</span></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Customer details */}
        <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:24 }}>
          <div>
            <label style={{ fontSize:13, color:'#8A9BC0', marginBottom:6, display:'block' }}>Full Name *</label>
            <input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" />
          </div>
          <div>
            <label style={{ fontSize:13, color:'#8A9BC0', marginBottom:6, display:'block' }}>Email Address *</label>
            <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" />
          </div>
          {p.collectPhone && (
            <div>
              <label style={{ fontSize:13, color:'#8A9BC0', marginBottom:6, display:'block' }}>Phone Number</label>
              <input style={inp} type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+92 300 0000000" />
            </div>
          )}
          {p.collectAddress && (
            <div>
              <label style={{ fontSize:13, color:'#8A9BC0', marginBottom:6, display:'block' }}>Billing Address</label>
              <textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Street, City, Country" />
            </div>
          )}
        </div>

        {error && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#EF4444', marginBottom:16 }}>{error}</div>}

        <button onClick={proceed} disabled={loading} style={{ width:'100%', background:'#0052FF', color:'white', border:'none', padding:'15px', borderRadius:12, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit', opacity:loading?0.6:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          {loading ? 'Processing…' : `Pay ${fmt(finalAmount)} →`}
        </button>

        <div style={{ textAlign:'center', marginTop:16, fontSize:12, color:'#8A9BC0', lineHeight:1.6 }}>
          🔒 Payments are secured by GoPayFast.<br/>
          Your card details are never stored on our servers.
        </div>
      </div>
    </div>
  );
}
