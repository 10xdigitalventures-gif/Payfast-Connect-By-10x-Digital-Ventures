
'use client';
import { useState } from 'react';

type Plan = { id:number; name:string; slug:string; price_monthly:number; price_yearly:number; max_locations:number; features:string[]|string|null; trial_days:number; };
type Props = { plans:Plan[]; defaultProvider:string; whopEnabled:boolean; };

const S: Record<string, React.CSSProperties> = {
  shell:        { minHeight:'100vh', background:'#0A0A0F', color:'white', fontFamily:'DM Sans,sans-serif', padding:'32px 16px' },
  wrap:         { maxWidth:680, margin:'0 auto', display:'flex', flexDirection:'column', gap:24 },
  card:         { background:'#13131A', border:'1px solid #1E1E2E', borderRadius:18, padding:28 },
  title:        { fontSize:22, fontWeight:800, color:'white', marginBottom:4 },
  sub:          { fontSize:14, color:'#888', marginBottom:20 },
  label:        { fontSize:13, fontWeight:600, color:'#888', marginBottom:6 },
  input:        { width:'100%', background:'#1A1A24', border:'1px solid #1E1E2E', borderRadius:10, padding:'11px 14px', color:'white', fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  btnPrimary:   { padding:'12px 20px', borderRadius:12, border:'none', background:'#0052FF', color:'white', fontWeight:700, fontSize:14, cursor:'pointer' },
  btnSecondary: { padding:'10px 18px', borderRadius:10, border:'1px solid #1E1E2E', background:'transparent', color:'#888', fontWeight:600, fontSize:13, cursor:'pointer' },
  btnRow:       { display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 },
  fieldGap:     { display:'flex', flexDirection:'column', gap:16 },
  steps:        { display:'flex', gap:0 },
  error:        { color:'#EF4444', fontSize:13, marginTop:8 },
  smallLabel:   { fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 },
  heroTitle:    { fontSize:28, fontWeight:800, color:'white', margin:'4px 0' },
  heroSub:      { fontSize:14, color:'#888' },
  planGrid:     { display:'flex', flexDirection:'column', gap:10 },
  planInner:    { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 },
  planName:     { fontSize:15, fontWeight:700, color:'white', marginBottom:2 },
  planMeta:     { fontSize:12, color:'#888', marginBottom:6 },
  featRow:      { display:'flex', flexWrap:'wrap', gap:6 },
  featBadge:    { fontSize:11, color:'#60A5FA', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:6, padding:'2px 8px' },
  priceCol:     { textAlign:'right', flexShrink:0 },
  priceVal:     { fontSize:18, fontWeight:800, color:'white' },
  priceSub:     { fontSize:11, color:'#888' },
  sectionWrap:  { marginBottom:20 },
  optRow:       { display:'flex', flexDirection:'column', gap:8, marginTop:8 },
  radioLabel:   { fontSize:14, fontWeight:600, color:'white', textTransform:'capitalize' },
  radioSub:     { fontSize:12, color:'#888' },
  summaryBox:   { background:'#1A1A24', border:'1px solid #1E1E2E', borderRadius:12, padding:'16px 18px', marginTop:16 },
  summaryTitle: { fontSize:13, fontWeight:700, color:'#888', marginBottom:12 },
  summaryRow:   { display:'flex', justifyContent:'space-between', fontSize:13, color:'#888', marginBottom:8 },
  summaryVal:   { color:'white', fontWeight:600 },
  summaryFreq:  { color:'white', fontWeight:600, textTransform:'capitalize' },
  summaryTotal: { display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, color:'white', marginTop:8, paddingTop:8, borderTop:'1px solid #1E1E2E' },
  trialNote:    { fontSize:12, color:'#22C55E', marginTop:8 },
  redirectBox:  { background:'#1A1A24', border:'1px solid #1E1E2E', borderRadius:12, padding:16, marginBottom:16 },
  redirectUrl:  { fontSize:12, color:'#60A5FA', wordBreak:'break-all', marginTop:4, marginBottom:12 },
  redirectLink: { display:'inline-block', padding:'10px 20px', background:'#0052FF', color:'white', borderRadius:10, fontWeight:700, fontSize:14, textDecoration:'none' },
  successTitle: { fontSize:22, fontWeight:800, color:'#22C55E', marginBottom:4 },
  successStrong:{ color:'white', fontWeight:600 },
  payfastMsg:   { fontSize:13, color:'#22C55E', marginBottom:16 },
  onboardBtn:   { marginTop:16, padding:'10px 20px', borderRadius:10, border:'1px solid #1E1E2E', background:'transparent', color:'#888', fontWeight:600, fontSize:13, cursor:'pointer' },
};

function stepStyle(active:boolean, done:boolean): React.CSSProperties {
  return { flex:1, padding:'8px 4px', textAlign:'center', fontSize:12, fontWeight:700, color: done?'#22C55E':active?'white':'#888', borderBottom:`2px solid ${done?'#22C55E':active?'#0052FF':'#1E1E2E'}`, background:'transparent', border:'none', cursor:'default' };
}
function planCardStyle(sel:boolean): React.CSSProperties {
  return { border:`2px solid ${sel?'#0052FF':'#1E1E2E'}`, background:sel?'rgba(0,82,255,0.08)':'#1A1A24', borderRadius:14, padding:18, cursor:'pointer' };
}
function radioStyle(active:boolean): React.CSSProperties {
  return { display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, border:`1px solid ${active?'#0052FF':'#1E1E2E'}`, background:active?'rgba(0,82,255,0.08)':'#1A1A24', cursor:'pointer' };
}
function dotStyle(active:boolean): React.CSSProperties {
  return { width:16, height:16, borderRadius:999, flexShrink:0, border:`2px solid ${active?'#0052FF':'#888'}`, background:active?'#0052FF':'transparent' };
}
function submitStyle(loading:boolean): React.CSSProperties {
  return { padding:'12px 20px', borderRadius:12, border:'none', background:'#0052FF', color:'white', fontWeight:700, fontSize:14, cursor: loading?'not-allowed':'pointer', opacity: loading?0.7:1 };
}
function parseFeatures(f:string[]|string|null): string[] {
  if (!f) return [];
  if (Array.isArray(f)) return f;
  try { return JSON.parse(f as string); } catch { return [String(f)]; }
}

export default function OnboardWizard({ plans, defaultProvider, whopEnabled }:Props) {
  const [step, setStep] = useState(1);
  const [locationId, setLocationId] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<Plan|null>(plans[0]||null);
  const [provider, setProvider] = useState(defaultProvider);
  const [frequency, setFrequency] = useState<'monthly'|'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const price = selectedPlan ? (frequency==='yearly'?selectedPlan.price_yearly:selectedPlan.price_monthly) : 0;

  async function submit() {
    if (!selectedPlan) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/agency/saas/subscribe', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ locationId, email, planId:selectedPlan.id, frequency, provider }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error||'Subscription failed');
      setResult(json); setStep(4);
    } catch (e) { setError(e instanceof Error?e.message:'Failed'); }
    finally { setLoading(false); }
  }

  if (step===4 && result) return (
    <div style={S.shell}><div style={S.wrap}><div style={S.card}>
      <div style={S.successTitle}>✓ Subscription Created</div>
      <div style={S.sub}>Location <strong style={S.successStrong}>{locationId}</strong> subscribed to <strong style={S.successStrong}>{selectedPlan?.name}</strong>.</div>
      {result.redirectUrl && (
        <div style={S.redirectBox}>
          <div style={S.label}>Whop Checkout Link (send to client):</div>
          <div style={S.redirectUrl}>{result.redirectUrl}</div>
          <a href={result.redirectUrl} target="_blank" rel="noopener noreferrer" style={S.redirectLink}>Open Whop Checkout</a>
        </div>
      )}
      {!result.redirectUrl && <div style={S.payfastMsg}>PayFast subscription recorded. GHL SaaS Configurator will handle billing.</div>}
      <button onClick={() => { setStep(1); setResult(null); setLocationId(''); setEmail(''); }} style={S.onboardBtn}>+ Onboard Another</button>
    </div></div></div>
  );

  return (
    <div style={S.shell}>
      <div style={S.wrap}>
        <div>
          <div style={S.smallLabel}>Agency Control Center</div>
          <div style={S.heroTitle}>Onboard New Client</div>
          <div style={S.heroSub}>Subscribe a sub-account to an agency SaaS plan.</div>
        </div>
        <div style={S.steps}>
          {(['Client Details','Select Plan','Confirm & Pay'] as const).map((label,i) => (
            <div key={label} style={stepStyle(step===i+1, step>i+1)}>{step>i+1?'✓ ':`${i+1}. `}{label}</div>
          ))}
        </div>
        {step===1 && (
          <div style={S.card}>
            <div style={S.title}>Client Details</div>
            <div style={S.sub}>Enter the GHL sub-account location ID and billing email.</div>
            <div style={S.fieldGap}>
              <div><div style={S.label}>GHL Location ID</div><input style={S.input} value={locationId} onChange={e=>setLocationId(e.target.value.trim())} placeholder="e.g. XATuRqXAuNpHyAST9U1b" /></div>
              <div><div style={S.label}>Billing Email</div><input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value.trim())} placeholder="client@example.com" /></div>
            </div>
            {error && <div style={S.error}>{error}</div>}
            <div style={S.btnRow}><button style={S.btnPrimary} onClick={() => { if (!locationId||!email) { setError('Both fields are required.'); return; } setError(''); setStep(2); }}>Next: Select Plan</button></div>
          </div>
        )}
        {step===2 && (
          <div style={S.card}>
            <div style={S.title}>Select Plan</div>
            <div style={S.sub}>Choose the SaaS plan for this client.</div>
            <div style={S.planGrid}>
              {plans.map(plan => (
                <div key={plan.id} style={planCardStyle(selectedPlan?.id===plan.id)} onClick={() => setSelectedPlan(plan)} role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') setSelectedPlan(plan); }}>
                  <div style={S.planInner}>
                    <div>
                      <div style={S.planName}>{plan.name}</div>
                      <div style={S.planMeta}>Up to {plan.max_locations} location{plan.max_locations!==1?'s':''}{plan.trial_days?` • ${plan.trial_days}d trial`:''}</div>
                      <div style={S.featRow}>{parseFeatures(plan.features).map(f => <span key={f} style={S.featBadge}>{f}</span>)}</div>
                    </div>
                    <div style={S.priceCol}><div style={S.priceVal}>PKR {Number(plan.price_monthly).toLocaleString()}</div><div style={S.priceSub}>/mo</div></div>
                  </div>
                </div>
              ))}
            </div>
            <div style={S.btnRow}>
              <button style={S.btnSecondary} onClick={() => setStep(1)}>Back</button>
              <button style={S.btnPrimary} onClick={() => { if (selectedPlan) setStep(3); }}>Next: Confirm</button>
            </div>
          </div>
        )}
        {step===3 && selectedPlan && (
          <div style={S.card}>
            <div style={S.title}>Confirm &amp; Pay</div>
            <div style={S.sub}>Choose billing frequency and payment provider.</div>
            <div style={S.sectionWrap}>
              <div style={S.label}>Billing Frequency</div>
              <div style={S.optRow}>
                {(['monthly','yearly'] as const).map(f => (
                  <div key={f} style={radioStyle(frequency===f)} onClick={() => setFrequency(f)} role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter') setFrequency(f); }}>
                    <div style={dotStyle(frequency===f)} />
                    <div><div style={S.radioLabel}>{f}</div><div style={S.radioSub}>PKR {Number(f==='yearly'?selectedPlan.price_yearly:selectedPlan.price_monthly).toLocaleString()}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.sectionWrap}>
              <div style={S.label}>Payment Provider</div>
              <div style={S.optRow}>
                <div style={radioStyle(provider==='payfast')} onClick={() => setProvider('payfast')} role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter') setProvider('payfast'); }}>
                  <div style={dotStyle(provider==='payfast')} />
                  <div><div style={S.radioLabel}>PayFast</div><div style={S.radioSub}>PKR billing via GHL SaaS Configurator</div></div>
                </div>
                {whopEnabled && (
                  <div style={radioStyle(provider==='whop')} onClick={() => setProvider('whop')} role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter') setProvider('whop'); }}>
                    <div style={dotStyle(provider==='whop')} />
                    <div><div style={S.radioLabel}>Whop</div><div style={S.radioSub}>USD recurring via Whop checkout</div></div>
                  </div>
                )}
              </div>
            </div>
            <div style={S.summaryBox}>
              <div style={S.summaryTitle}>Order Summary</div>
              <div style={S.summaryRow}><span>Location</span><span style={S.summaryVal}>{locationId}</span></div>
              <div style={S.summaryRow}><span>Plan</span><span style={S.summaryVal}>{selectedPlan.name}</span></div>
              <div style={S.summaryRow}><span>Frequency</span><span style={S.summaryFreq}>{frequency}</span></div>
              <div style={S.summaryRow}><span>Email</span><span style={S.summaryVal}>{email}</span></div>
              <div style={S.summaryTotal}><span>Total</span><span>PKR {Number(price).toLocaleString()}</span></div>
              {selectedPlan.trial_days>0 && <div style={S.trialNote}>★ {selectedPlan.trial_days}-day free trial applies</div>}
            </div>
            {error && <div style={S.error}>{error}</div>}
            <div style={S.btnRow}>
              <button style={S.btnSecondary} onClick={() => setStep(2)} disabled={loading}>Back</button>
              <button style={submitStyle(loading)} onClick={submit} disabled={loading}>{loading?'Creating…':provider==='whop'?'Create Whop Checkout':'Activate Subscription'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
