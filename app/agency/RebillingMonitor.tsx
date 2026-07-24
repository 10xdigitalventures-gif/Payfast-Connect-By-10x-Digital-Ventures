
'use client';
import { useCallback, useEffect, useState } from 'react';

type TodayStats = { paid:number; failed:number; pending:number; paid_amount:number; last_invoice_at:string|null; };
type FailedRow  = { id:number; location_id:string; display_name:string; plan_name:string|null; amount:number; created_at:string; };
type Totals     = { total_paid:number; total_failed:number; total_revenue:number; };
type SubStats   = { active:number; trial:number; past_due:number; suspended:number; };
type Data       = { today:TodayStats; recentFailed:FailedRow[]; todaySuspensions:number; totals:Totals; subscriptions:SubStats; };

const S: Record<string, React.CSSProperties> = {
  wrap:         { display:'flex', flexDirection:'column', gap:20 },
  card:         { background:'var(--dark2)', border:'1px solid var(--border)', borderRadius:18, padding:22 },
  cardHeader:   { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:16, flexWrap:'wrap' },
  cardTitle:    { fontSize:15, fontWeight:700, color:'white', marginBottom:4 },
  cardSub:      { fontSize:13, color:'var(--gray)', lineHeight:'1.5' },
  refreshBtn:   { fontSize:12, background:'var(--dark3)', border:'1px solid var(--border)', color:'var(--gray)', borderRadius:8, padding:'6px 12px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
  secLabel:     { fontSize:12, fontWeight:700, color:'var(--gray)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10, marginTop:16 },
  statGrid:     { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:12 },
  statCard:     { background:'var(--dark3)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 12px', textAlign:'center' },
  statVal:      { fontSize:20, fontWeight:800, color:'white', margin:'4px 0 2px' },
  statLbl:      { fontSize:11, color:'var(--gray)' },
  TH:           { textAlign:'left', padding:'8px 10px', color:'var(--gray)', fontWeight:600, fontSize:12, borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' },
  TD:           { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:13, color:'var(--gray)' },
  TDnw:         { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:13, color:'var(--gray)', whiteSpace:'nowrap' },
  tableWrap:    { overflowX:'auto', marginTop:8 },
  table:        { width:'100%', borderCollapse:'collapse' },
  nameBold:     { color:'white', fontWeight:600 },
  subText:      { fontSize:11, color:'var(--gray)', marginTop:2 },
  emptyGreen:   { color:'#22C55E', fontSize:13, padding:'12px 0' },
  emptyGray:    { color:'var(--gray)', fontSize:13, padding:'10px 0' },
  errText:      { color:'#EF4444', fontSize:13, padding:'10px 0' },
  lastAt:       { fontSize:12, color:'var(--gray)', marginTop:12 },
  lastAtVal:    { color:'white', fontWeight:600 },
  cronBox:      { background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.18)', borderRadius:14, padding:'14px 18px' },
  cronTitle:    { fontSize:14, fontWeight:700, color:'#FBBF24', marginBottom:6 },
  cronText:     { fontSize:13, color:'var(--gray)', lineHeight:'1.6' },
  code:         { fontFamily:'monospace', background:'rgba(255,255,255,0.06)', borderRadius:4, padding:'2px 6px', fontSize:12, color:'#60A5FA' },
};

function badgeStyle(color:string, bg:string): React.CSSProperties {
  return { fontSize:11, fontWeight:700, color, background:bg, border:`1px solid ${color}44`, borderRadius:999, padding:'2px 9px' };
}
function Bdg({ label, color, bg }:{ label:string; color:string; bg:string }) {
  return <span style={badgeStyle(color, bg)}>{label}</span>;
}
function Stat({ label, value }:{ label:string; value:string|number }) {
  return <div style={S.statCard}><div style={S.statLbl}>{label}</div><div style={S.statVal}>{value}</div></div>;
}

export default function RebillingMonitor() {
  const [data, setData] = useState<Data|null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    fetch('/api/agency/saas/rebilling-status').then(r=>r.json()).then(d=>{ setData(d); setLoading(false); }).catch(()=>setLoading(false));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <div><div style={S.cardTitle}>Cron &amp; Rebilling Health</div><div style={S.cardSub}>Today’s billing activity and subscription snapshot.</div></div>
          <button onClick={reload} style={S.refreshBtn}>&#8635; Refresh</button>
        </div>
        {loading ? <div style={S.emptyGray}>Loading…</div> : !data ? <div style={S.errText}>Failed to load stats.</div> : (
          <>
            <div style={S.secLabel}>Today</div>
            <div style={S.statGrid}>
              <Stat label="Paid"       value={Number(data.today.paid||0)} />
              <Stat label="Failed"     value={Number(data.today.failed||0)} />
              <Stat label="Pending"    value={Number(data.today.pending||0)} />
              <Stat label="Collected" value={`PKR ${Number(data.today.paid_amount||0).toLocaleString()}`} />
              <Stat label="Suspensions" value={data.todaySuspensions} />
            </div>
            <div style={S.secLabel}>Subscriptions</div>
            <div style={S.statGrid}>
              <Stat label="Active"    value={Number(data.subscriptions.active||0)} />
              <Stat label="Trial"     value={Number(data.subscriptions.trial||0)} />
              <Stat label="Past Due"  value={Number(data.subscriptions.past_due||0)} />
              <Stat label="Suspended" value={Number(data.subscriptions.suspended||0)} />
            </div>
            <div style={S.secLabel}>All-Time</div>
            <div style={S.statGrid}>
              <Stat label="Total Paid"   value={Number(data.totals.total_paid||0)} />
              <Stat label="Total Failed" value={Number(data.totals.total_failed||0)} />
              <Stat label="Revenue" value={`PKR ${Number(data.totals.total_revenue||0).toLocaleString()}`} />
            </div>
            {data.today.last_invoice_at && <div style={S.lastAt}>Last billing event: <span style={S.lastAtVal}>{new Date(data.today.last_invoice_at).toLocaleString()}</span></div>}
          </>
        )}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Recent Failed Invoices</div>
        <div style={S.cardSub}>Last 5 failed billing attempts across all sub-accounts.</div>
        {loading ? <div style={S.emptyGray}>Loading…</div> : !data||data.recentFailed.length===0 ? <div style={S.emptyGreen}>&#10003; No failed invoices.</div> : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.TH}>#</th><th style={S.TH}>Location</th><th style={S.TH}>Plan</th><th style={S.TH}>Amount</th><th style={S.TH}>Date</th><th style={S.TH}>Status</th>
              </tr></thead>
              <tbody>
                {data.recentFailed.map(row => (
                  <tr key={row.id}>
                    <td style={S.TD}>#{row.id}</td>
                    <td style={S.TD}><div style={S.nameBold}>{row.display_name}</div><div style={S.subText}>{row.location_id}</div></td>
                    <td style={S.TD}>{row.plan_name||'—'}</td>
                    <td style={S.TDnw}>PKR {Number(row.amount).toLocaleString()}</td>
                    <td style={S.TDnw}>{new Date(row.created_at).toLocaleDateString()}</td>
                    <td style={S.TD}><Bdg label="failed" color="#EF4444" bg="rgba(239,68,68,0.12)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={S.cronBox}>
        <div style={S.cronTitle}>&#9888; Cron Setup Reminder</div>
        <div style={S.cronText}>
          Set up a daily cron job calling <code style={S.code}>POST /api/rebilling/run</code> with header <code style={S.code}>x-rebilling-secret: REBILLING_SECRET</code>. This processes overdue invoices and enforces suspensions automatically.
        </div>
      </div>
    </div>
  );
}
