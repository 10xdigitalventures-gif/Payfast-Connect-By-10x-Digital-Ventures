'use client';

import { useCallback, useEffect, useState } from 'react';

type PastDueRow = {
  location_id: string;
  display_name: string;
  status: string;
  grace_until: string | null;
  last_payment_at: string | null;
  plan_name: string | null;
  amount: number | null;
  provider: string | null;
};

type ActionRow = {
  id: number;
  location_id: string;
  display_name: string;
  action: string;
  strategy: string;
  reason: string | null;
  ghl_status: number | null;
  created_at: string;
};

// ---- style constants (no inline style objects in JSX) -------------------
const sWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 20 };
const sCard: React.CSSProperties = { background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 18, padding: 22 };
const sCardHeader: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' };
const sCardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 4 };
const sCardSub: React.CSSProperties = { fontSize: 13, color: 'var(--gray)', lineHeight: '1.5' };
const sRefreshBtn: React.CSSProperties = { fontSize: 12, background: 'var(--dark3)', border: '1px solid var(--border)', color: 'var(--gray)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 };
const sTH: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', color: 'var(--gray)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12, borderBottom: '1px solid var(--border)' };
const sTD: React.CSSProperties = { padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle', fontSize: 13, color: 'var(--gray)' };
const sTDCaps: React.CSSProperties = { ...sTD, textTransform: 'capitalize' };
const sTDNowrap: React.CSSProperties = { ...sTD, whiteSpace: 'nowrap' };
const sTDSmall: React.CSSProperties = { ...sTD, fontSize: 12, whiteSpace: 'nowrap' };
const sTableWrap: React.CSSProperties = { overflowX: 'auto', marginTop: 4 };
const sTable: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const sEmptyGreen: React.CSSProperties = { color: '#22C55E', fontSize: 13, padding: '14px 0' };
const sEmptyGray: React.CSSProperties = { color: 'var(--gray)', fontSize: 13, padding: '10px 0' };
const sNameBold: React.CSSProperties = { color: 'white', fontWeight: 600 };
const sSubText: React.CSSProperties = { fontSize: 11, color: 'var(--gray)', marginTop: 2 };
const sResumeBtn: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(34,197,94,0.15)', color: '#22C55E' };
const sToggleBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '0', fontSize: 15, fontWeight: 700 };
const sLogSub: React.CSSProperties = { fontSize: 13, color: 'var(--gray)', marginTop: 4, marginBottom: 14 };
const sEventCount: React.CSSProperties = { fontSize: 12, color: 'var(--gray)', fontWeight: 400 };
const sOrange: React.CSSProperties = { color: '#F97316' };
const sRed: React.CSSProperties = { color: '#EF4444' };

function graceStyle(grace: string | null): React.CSSProperties {
  return { ...sTDNowrap, color: grace ? '#F97316' : 'var(--gray)' };
}

function msgStyle(type: 'success' | 'error'): React.CSSProperties {
  const ok = type === 'success';
  return { fontSize: 13, padding: '8px 14px', borderRadius: 8, marginBottom: 14, color: ok ? '#22C55E' : '#EF4444', background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${ok ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}` };
}
// -------------------------------------------------------------------------

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  const sB: React.CSSProperties = { display: 'inline-block', fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${color}44`, borderRadius: 999, padding: '3px 10px', textTransform: 'capitalize' };
  return <span style={sB}>{label}</span>;
}

function StatusBadge({ s }: { s: string }) {
  const pastDue = s === 'past_due';
  return <Badge label={s.replace('_', ' ')} color={pastDue ? '#F97316' : '#EF4444'} bg={pastDue ? 'rgba(249,115,22,0.14)' : 'rgba(239,68,68,0.14)'} />;
}

function ActionBadge({ a }: { a: string }) {
  const resume = a === 'resume';
  return <Badge label={a} color={resume ? '#22C55E' : '#EF4444'} bg={resume ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'} />;
}

function GhlBadge({ code }: { code: number | null }) {
  if (code == null) return <span style={sEmptyGray}>&mdash;</span>;
  const ok = code < 300;
  return <Badge label={String(code)} color={ok ? '#22C55E' : '#F97316'} bg={ok ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)'} />;
}

export default function SuspensionPanel() {
  const [data, setData] = useState<{ pastDue: PastDueRow[]; recentActions: ActionRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetch('/api/agency/saas/suspension-status')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function resumeLocation(locationId: string) {
    setActionLoading(locationId);
    setMsg(null);
    try {
      const res = await fetch('/api/agency/saas/resume-location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || 'Failed');
      setMsg({ type: 'success', text: `✓ ${locationId} resumed.` });
      reload();
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Resume failed' });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div style={sWrap}>

      {/* Past Due and Suspended */}
      <div style={sCard}>
        <div style={sCardHeader}>
          <div>
            <div style={sCardTitle}>Past Due &amp; Suspended Locations</div>
            <div style={sCardSub}>
              <strong style={sOrange}>Past Due</strong> = inside grace window (auto-suspend pending);&nbsp;
              <strong style={sRed}>Suspended</strong> = GHL access paused.
            </div>
          </div>
          <button onClick={reload} style={sRefreshBtn}>&#8635; Refresh</button>
        </div>

        {msg && <div style={msgStyle(msg.type)}>{msg.text}</div>}

        {loading ? (
          <div style={sEmptyGray}>Loading&hellip;</div>
        ) : !data || data.pastDue.length === 0 ? (
          <div style={sEmptyGreen}>&#10003; No locations are past due or suspended.</div>
        ) : (
          <div style={sTableWrap}>
            <table style={sTable}>
              <thead>
                <tr>
                  <th style={sTH}>Name</th>
                  <th style={sTH}>Status</th>
                  <th style={sTH}>Plan</th>
                  <th style={sTH}>Provider</th>
                  <th style={sTH}>Grace Until</th>
                  <th style={sTH}>Last Payment</th>
                  <th style={sTH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.pastDue.map((row) => (
                  <tr key={row.location_id}>
                    <td style={sTD}><div style={sNameBold}>{row.display_name}</div><div style={sSubText}>{row.location_id}</div></td>
                    <td style={sTD}><StatusBadge s={row.status} /></td>
                    <td style={sTD}>{row.plan_name || '—'}</td>
                    <td style={sTDCaps}>{row.provider || '—'}</td>
                    <td style={graceStyle(row.grace_until)}>{row.grace_until ? new Date(row.grace_until).toLocaleDateString() : '—'}</td>
                    <td style={sTDNowrap}>{row.last_payment_at ? new Date(row.last_payment_at).toLocaleDateString() : '—'}</td>
                    <td style={sTD}>
                      <button onClick={() => resumeLocation(row.location_id)} disabled={!!actionLoading} style={sResumeBtn}>
                        {actionLoading === row.location_id ? 'Resuming…' : 'Resume'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Suspension Audit Log */}
      <div style={sCard}>
        <button onClick={() => setShowHistory((v) => !v)} style={sToggleBtn}>
          <span>{showHistory ? '▾' : '▸'}</span>
          Suspension Audit Log
          {data && data.recentActions.length > 0 && <span style={sEventCount}>&nbsp;({data.recentActions.length} events)</span>}
        </button>
        <div style={sLogSub}>Every suspend / resume action &mdash; strategy used, GHL HTTP response, and timestamp.</div>

        {showHistory && (
          loading ? (
            <div style={sEmptyGray}>Loading&hellip;</div>
          ) : !data || data.recentActions.length === 0 ? (
            <div style={sEmptyGray}>No suspension events recorded yet.</div>
          ) : (
            <div style={sTableWrap}>
              <table style={sTable}>
                <thead>
                  <tr>
                    <th style={sTH}>Time</th>
                    <th style={sTH}>Location</th>
                    <th style={sTH}>Action</th>
                    <th style={sTH}>Strategy</th>
                    <th style={sTH}>Reason</th>
                    <th style={sTH}>GHL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActions.map((row) => (
                    <tr key={row.id}>
                      <td style={sTDSmall}>{new Date(row.created_at).toLocaleString()}</td>
                      <td style={sTD}><div style={sNameBold}>{row.display_name}</div><div style={sSubText}>{row.location_id}</div></td>
                      <td style={sTD}><ActionBadge a={row.action} /></td>
                      <td style={sTDSmall}>{row.strategy}</td>
                      <td style={sTDSmall}>{row.reason || '—'}</td>
                      <td style={sTD}><GhlBadge code={row.ghl_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

    </div>
  );
}
