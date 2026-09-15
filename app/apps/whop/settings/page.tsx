'use client';
import { useEffect,useState,type CSSProperties } from 'react';
type Config={whop_api_key:string;whop_company_id:string;whop_webhook_secret:string;whop_rate_mode:'fixed'|'live';whop_exchange_rate:string;whop_fee_percent:string;whop_currency:'PKR'|'USD'};
const empty:Config={whop_api_key:'',whop_company_id:'',whop_webhook_secret:'',whop_rate_mode:'fixed',whop_exchange_rate:'280',whop_fee_percent:'10',whop_currency:'PKR'};
export default function WhopSettings(){
 const[locationId,setLocationId]=useState('');const[config,setConfig]=useState(empty);const[state,setState]=useState('loading');const[error,setError]=useState('');
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('locationId')||'';if(!id){setError('Open this Whop app from HighLevel Payments → Integrations.');setState('ready');return;}setLocationId(id);
 fetch(`/api/apps/whop/config?locationId=${encodeURIComponent(id)}`,{cache:'no-store'}).then(r=>r.json()).then(d=>{if(d?.installed)setConfig({...empty,...d});}).catch(()=>setError('Could not load Whop settings.')).finally(()=>setState('ready'));},[]);
 const set=(key:keyof Config,value:string)=>setConfig(current=>({...current,[key]:value}));
 async function save(){setState('saving');setError('');try{const response=await fetch('/api/apps/whop/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...config,locationId})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||'Save failed');setState('saved');}catch(e){setError(e instanceof Error?e.message:'Save failed');setState('ready');}}
 const field:CSSProperties={display:'grid',gap:6};const input:CSSProperties={padding:11,border:'1px solid #cbd5e1',borderRadius:8};
 return <main style={{minHeight:'100vh',background:'#f8fafc',padding:24,fontFamily:'system-ui'}}><section style={{maxWidth:620,margin:'0 auto',background:'#fff',padding:28,borderRadius:16,border:'1px solid #e2e8f0'}}>
 <h1>10x Whop App</h1><p style={{color:'#64748b'}}>Whop-only settings. PayFast and Swich are configured in their own apps.</p><div style={{display:'grid',gap:16}}>
 <label style={field}>Whop API Key<input type="password" style={input} value={config.whop_api_key} onChange={e=>set('whop_api_key',e.target.value)}/></label>
 <label style={field}>Company ID<input style={input} value={config.whop_company_id} onChange={e=>set('whop_company_id',e.target.value)}/></label>
 <label style={field}>Webhook Secret<input type="password" style={input} value={config.whop_webhook_secret} onChange={e=>set('whop_webhook_secret',e.target.value)}/></label>
 <label style={field}>Exchange Rate Mode<select style={input} value={config.whop_rate_mode} onChange={e=>set('whop_rate_mode',e.target.value)}><option value="fixed">Fixed</option><option value="live">Live</option></select></label>
 <label style={field}>USD to PKR Rate<input style={input} value={config.whop_exchange_rate} onChange={e=>set('whop_exchange_rate',e.target.value)}/></label>
 <label style={field}>Gateway Fee %<input style={input} value={config.whop_fee_percent} onChange={e=>set('whop_fee_percent',e.target.value)}/></label>
 <label style={field}>Product Currency<select style={input} value={config.whop_currency} onChange={e=>set('whop_currency',e.target.value)}><option>PKR</option><option>USD</option></select></label></div>
 <div style={{marginTop:20,padding:12,background:'#eff6ff',borderRadius:8}}>Whop webhook: {typeof window!=='undefined'?window.location.origin:''}/api/apps/whop/webhook</div>
 <button disabled={state==='saving'||!locationId} onClick={save} style={{width:'100%',marginTop:20,padding:13,border:0,borderRadius:9,background:'#2563eb',color:'#fff',fontWeight:800}}>{state==='saving'?'Saving…':state==='saved'?'Saved and connected':'Save Whop settings'}</button>{error?<p style={{color:'#b91c1c'}}>{error}</p>:null}</section></main>;
}
