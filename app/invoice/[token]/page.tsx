import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import Link from 'next/link';

export default async function PublicInvoicePage({ params }:{ params: Promise<{ token:string }> }) {
  const rows = await query<any[]>(
    `SELECT inv.*, i.merchant_id, i.merchant_key, i.passphrase, i.environment
     FROM invoices inv
     JOIN installations i ON i.location_id = inv.location_id
     WHERE inv.token = ?`, [(await params).token]
  );
  if (!rows.length) notFound();
  const inv = rows[0];

  const items = await query<any[]>(
    'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [inv.id]
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const payUrl = `${appUrl}/pay/${inv.token}`;
  const isPaid = inv.status === 'paid';
  const isCancelled = inv.status === 'cancelled';

  const fmt = (n:number) => `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits:2 })}`;

  // Mark as viewed if sent
  if (inv.status === 'sent') {
    await query("UPDATE invoices SET status='viewed' WHERE id=?", [inv.id]);
  }

  return (
    <div className="page-shell-light" style={{ fontFamily:'DM Sans, sans-serif', color:'#0F172A' }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header bar */}
      <div className="page-nav" style={{ background:'white', borderBottom:'1px solid #E2E8F0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:'#0052FF', borderRadius:8, display:'grid', placeItems:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13H11L10 22L19.5 11H13Z"/></svg>
          </div>
          <span style={{ fontFamily:'var(--font-head)', fontWeight:700, fontSize:14, color:'#0F172A' }}>10x Digital Ventures</span>
        </div>
        <span style={{ fontSize:12, color:'#64748B' }}>Invoice {inv.invoice_number}</span>
      </div>

      <div className="page-container" style={{ maxWidth:700, padding:'40px 24px 60px' }}>
        {/* Status banner */}
        {isPaid && (
          <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:10, padding:'12px 20px', marginBottom:24, display:'flex', alignItems:'center', gap:8, fontSize:14, color:'#22C55E', fontWeight:500 }}>
            ✅ This invoice has been paid. Thank you!
          </div>
        )}
        {isCancelled && (
          <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'12px 20px', marginBottom:24, fontSize:14, color:'#EF4444' }}>
            ❌ This invoice has been cancelled.
          </div>
        )}

        {/* Invoice card */}
        <div style={{ background:'white', border:'1px solid #E2E8F0', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* Top */}
            <div style={{ padding:'32px 36px', borderBottom:'1px solid #F1F5F9', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily:'var(--font-head)', fontSize:24, fontWeight:800, marginBottom:4 }}>{inv.title}</div>
              <div style={{ fontSize:14, color:'#64748B' }}>Invoice Number: <strong style={{ color:'#0F172A' }}>{inv.invoice_number}</strong></div>
              <div style={{ fontSize:13, color:'#64748B', marginTop:4 }}>Issue Date: {new Date(inv.issue_date).toLocaleDateString('en-PK', { day:'numeric', month:'long', year:'numeric' })}</div>
              {inv.due_date && <div style={{ fontSize:13, color:'#EF4444', marginTop:2 }}>Due: {new Date(inv.due_date).toLocaleDateString('en-PK', { day:'numeric', month:'long', year:'numeric' })}</div>}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:13, color:'#64748B', marginBottom:4 }}>Bill To</div>
              <div style={{ fontWeight:600, fontSize:15 }}>{inv.client_name}</div>
              <div style={{ fontSize:13, color:'#64748B' }}>{inv.client_email}</div>
              {inv.client_phone && <div style={{ fontSize:13, color:'#64748B' }}>{inv.client_phone}</div>}
              {inv.client_address && <div style={{ fontSize:12, color:'#64748B', marginTop:4, maxWidth:200, lineHeight:1.4 }}>{inv.client_address}</div>}
            </div>
          </div>

          {/* Line Items */}
          {items.length > 0 && (
            <div style={{ padding:'0 36px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #F1F5F9' }}>
                    {['Item','Qty','Unit Price','Total'].map(h=>(
                      <th key={h} style={{ padding:'14px 8px', fontSize:11, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px', textAlign:h==='Item'?'left':'right', fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it:any) => (
                    <tr key={it.id} style={{ borderBottom:'1px solid #F8FAFC' }}>
                      <td style={{ padding:'14px 8px' }}>
                        <div style={{ fontWeight:500, fontSize:14 }}>{it.name}</div>
                        {it.description && <div style={{ fontSize:12, color:'#94A3B8', marginTop:2 }}>{it.description}</div>}
                      </td>
                      <td style={{ padding:'14px 8px', textAlign:'right', fontSize:14, color:'#64748B' }}>{it.quantity}</td>
                      <td style={{ padding:'14px 8px', textAlign:'right', fontSize:14 }}>{fmt(it.unit_price)}</td>
                      <td style={{ padding:'14px 8px', textAlign:'right', fontSize:14, fontWeight:500 }}>{fmt(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Simple mode description */}
          {inv.mode === 'simple' && inv.notes && (
            <div style={{ padding:'20px 36px', borderBottom:'1px solid #F1F5F9' }}>
              <div style={{ fontSize:14, color:'#64748B' }}>{inv.notes}</div>
            </div>
          )}

          {/* Totals */}
          <div style={{ padding:'20px 36px', background:'#F8FAFC', borderTop:'1px solid #E2E8F0' }}>
            <div style={{ maxWidth:280, marginLeft:'auto' }}>
              {[
                { label:'Subtotal', val:fmt(inv.subtotal), show: true },
                { label:`Discount`, val:`-${fmt(inv.discount_amount)}`, show: inv.discount_amount > 0 },
                { label:`Tax (${inv.tax_rate}%)`, val:fmt(inv.tax_amount), show: inv.tax_amount > 0 },
              ].filter(r=>r.show).map(r=>(
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#64748B', padding:'4px 0' }}>
                  <span>{r.label}</span><span>{r.val}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0 0', borderTop:'2px solid #E2E8F0', marginTop:8 }}>
                <span style={{ fontFamily:'var(--font-head)', fontWeight:700, fontSize:16 }}>Total Due</span>
                <span style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:20, color:'#0052FF' }}>{fmt(inv.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes / Terms */}
          {(inv.notes || inv.terms) && (
            <div className="mobile-stack-2" style={{ padding:'20px 36px', borderTop:'1px solid #E2E8F0' }}>
              {inv.notes && <div><div style={{ fontSize:11, color:'#94A3B8', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Notes</div><div style={{ fontSize:13, color:'#64748B', lineHeight:1.6 }}>{inv.notes}</div></div>}
              {inv.terms && <div><div style={{ fontSize:11, color:'#94A3B8', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Terms</div><div style={{ fontSize:13, color:'#64748B', lineHeight:1.6 }}>{inv.terms}</div></div>}
            </div>
          )}
        </div>

        {/* Pay button */}
        {!isPaid && !isCancelled && (
          <div style={{ textAlign:'center', marginTop:28 }}>
            <a href={payUrl} style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#0052FF', color:'white', padding:'15px 40px', borderRadius:12, fontFamily:'var(--font-head)', fontWeight:700, fontSize:16, textDecoration:'none' }}>
              Pay {fmt(inv.total)} →
            </a>
            <div style={{ marginTop:12, fontSize:12, color:'#94A3B8' }}>🔒 Secured by GoPayFast</div>
          </div>
        )}
      </div>
    </div>
  );
}
