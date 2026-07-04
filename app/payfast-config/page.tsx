'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

interface Cfg {
  merchant_id: string;
  merchant_name: string;
  store_id: string;
  merchant_key: string;
  passphrase: string;
  environment: string;
  whop_enabled: boolean;
  whop_api_key: string;
  whop_company_id: string;
  whop_webhook_secret: string;
  whop_rate_mode: string;
  whop_exchange_rate: string;
  whop_fee_percent: string;
  whop_currency: string;
  route_oneoff: string;
  route_subscription: string;
}

const DEFAULT_CFG: Cfg = {
  merchant_id: '', merchant_name: '', store_id: '', merchant_key: '', passphrase: '',
  environment: 'live', whop_enabled: false, whop_api_key: '', whop_company_id: '',
  whop_webhook_secret: '', whop_rate_mode: 'fixed', whop_exchange_rate: '280',
  whop_fee_percent: '10', whop_currency: 'PKR', route_oneoff: 'payfast', route_subscription: 'whop',
};

export default function PayfastConfigPage() {
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [locationId, setLocationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [ctxError, setCtxError] = useState('');

  const set = (k: keyof Cfg, v: string | boolean) => setCfg(c => ({ ...c, [k]: v }));

  async function loadConfig(loc: string) {
    try {
      const res = await fetch(`/api/ghl/config?locationId=${encodeURIComponent(loc)}`);
      const d = await res.json();
      if (d && d.installed) setCfg(c => ({ ...c, ...d }));
    } catch {
      // keep defaults on failure
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let resolved = false;

    if (typeof window !== 'undefined') {
      const qp = new URLSearchParams(window.location.search);
      const qLoc = qp.get('locationId');
      if (qLoc) {
        resolved = true;
        setLocationId(qLoc);
        loadConfig(qLoc);
        return;
      }
    }

    async function handleMessage(ev: MessageEvent) {
      const data: any = ev.data;
      if (!data || data.message !== 'REQUEST_USER_DATA_RESPONSE') return;
      try {
        const res = await fetch('/api/sso/decode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedData: data.payload }),
        });
        const ctx = await res.json();
        if (ctx && ctx.locationId) {
          resolved = true;
          setLocationId(ctx.locationId);
          loadConfig(ctx.locationId);
        } else {
          setCtxError('Could not read your HighLevel location. Open this page from Payments → Integrations.');
          setLoading(false);
        }
      } catch {
        setCtxError('Failed to verify your HighLevel session. Please reload the integration page.');
        setLoading(false);
      }
    }

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');

    const timer = setTimeout(() => {
      if (!resolved) {
        setCtxError('Timed out waiting for HighLevel. Please reload this page from Payments → Integrations.');
        setLoading(false);
      }
    }, 6000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!locationId) { setError('No HighLevel location detected yet.'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await fetch('/api/ghl/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, locationId }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || d.message || 'Failed to save. Please check your details and try again.');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const isSandbox = cfg.environment === 'sandbox' || cfg.environment === 'test';

  const wrap: CSSProperties = { minHeight: '100vh', background: '#f1f5f9', padding: '32px 16px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#0f172a' };
  const card: CSSProperties = { maxWidth: 640, margin: '0 auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' };
  const brandRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 };
  const brandDot: CSSProperties = { width: 40, height: 40, borderRadius: 10, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
  const h1: CSSProperties = { fontSize: 20, fontWeight: 700, margin: 0 };
  const sub: CSSProperties = { fontSize: 13, color: '#64748b', margin: '2px 0 0' };
  const sectionTitle: CSSProperties = { fontSize: 14, fontWeight: 700, margin: '26px 0 12px', color: '#0f172a' };
  const label: CSSProperties = { display: 'block', fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: 500 };
  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#0f172a', outline: 'none', fontFamily: 'inherit', background: '#fff' };
  const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
  const field: CSSProperties = { marginBottom: 14 };
  const toggleRow: CSSProperties = { display: 'flex', gap: 8 };
  const hint: CSSProperties = { fontSize: 12, color: '#64748b', marginTop: 6 };
  const modeBtn = (active: boolean): CSSProperties => ({ flex: 1, textAlign: 'center', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, userSelect: 'none', transition: 'all 0.2s ease', background: active ? '#2563EB' : '#fff', color: active ? '#fff' : '#475569', border: active ? '1px solid #2563EB' : '1px solid #cbd5e1' });
  const checkboxRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc', marginBottom: 6 };
  const checkbox: CSSProperties = { width: 18, height: 18, accentColor: '#2563EB', cursor: 'pointer' };
  const checkboxText: CSSProperties = { fontSize: 14, fontWeight: 600, color: '#0f172a' };
  const divider: CSSProperties = { height: 1, background: '#e2e8f0', margin: '24px 0' };
  const saveBtn: CSSProperties = { width: '100%', marginTop: 24, padding: '13px 16px', borderRadius: 10, border: 'none', background: saving ? '#93b4f5' : '#2563EB', color: '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer', transition: 'background 0.2s ease' };
  const okMsg: CSSProperties = { marginTop: 14, padding: '11px 14px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontSize: 13, fontWeight: 600 };
  const errMsg: CSSProperties = { marginTop: 14, padding: '11px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 600 };
  const warn: CSSProperties = { marginTop: 4, marginBottom: 12, padding: '11px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13 };
  const muted: CSSProperties = { fontSize: 14, color: '#64748b', textAlign: 'center', padding: '24px 0' };
  const codeBox: CSSProperties = { marginTop: 8, padding: '10px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8 };
  const codeText: CSSProperties = { fontSize: 12, color: '#2563EB', wordBreak: 'break-all', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };

  if (loading) {
    return (
      <main style={wrap}>
        <div style={card}><p style={muted}>Loading configuration…</p></div>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <div style={card}>
        <div style={brandRow}>
          <div style={brandDot}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div>
            <h1 style={h1}>Payment Provider Configuration</h1>
            <p style={sub}>PayFast &amp; Whop — connected to HighLevel</p>
          </div>
        </div>

        {ctxError ? <div style={warn}>{ctxError}</div> : null}

        <div style={sectionTitle}>Environment</div>
        <div style={toggleRow}>
          <div onClick={() => set('environment', 'live')} style={modeBtn(!isSandbox)}>Live</div>
          <div onClick={() => set('environment', 'sandbox')} style={modeBtn(isSandbox)}>Sandbox</div>
        </div>
        <div style={hint}>Live processes real payments. Sandbox is for testing only.</div>

        <div style={sectionTitle}>PayFast credentials</div>
        <div style={grid2}>
          <div style={field}>
            <label style={label}>Merchant ID</label>
            <input style={input} value={cfg.merchant_id} onChange={e => set('merchant_id', e.target.value)} placeholder="10000100" />
          </div>
          <div style={field}>
            <label style={label}>Merchant Key</label>
            <input style={input} value={cfg.merchant_key} onChange={e => set('merchant_key', e.target.value)} placeholder="46f0cd694581a" />
          </div>
        </div>
        <div style={grid2}>
          <div style={field}>
            <label style={label}>Store / Merchant Name</label>
            <input style={input} value={cfg.merchant_name} onChange={e => set('merchant_name', e.target.value)} placeholder="My Store" />
          </div>
          <div style={field}>
            <label style={label}>Store ID</label>
            <input style={input} value={cfg.store_id} onChange={e => set('store_id', e.target.value)} placeholder="store-001" />
          </div>
        </div>
        <div style={field}>
          <label style={label}>Passphrase (Shared Secret)</label>
          <input style={input} value={cfg.passphrase} onChange={e => set('passphrase', e.target.value)} placeholder="Your PayFast passphrase" />
        </div>

        <div style={divider} />

        <div style={sectionTitle}>Whop (subscriptions &amp; card charging)</div>
        <label style={checkboxRow}>
          <input type="checkbox" style={checkbox} checked={cfg.whop_enabled} onChange={e => set('whop_enabled', e.target.checked)} />
          <span style={checkboxText}>Enable Whop as a payment provider</span>
        </label>

        {cfg.whop_enabled ? (
          <div>
            <div style={grid2}>
              <div style={field}>
                <label style={label}>Whop API Key</label>
                <input style={input} value={cfg.whop_api_key} onChange={e => set('whop_api_key', e.target.value)} placeholder="Your Whop API key" />
              </div>
              <div style={field}>
                <label style={label}>Whop Company ID</label>
                <input style={input} value={cfg.whop_company_id} onChange={e => set('whop_company_id', e.target.value)} placeholder="biz_xxxxxxxx" />
              </div>
            </div>
            <div style={field}>
              <label style={label}>Webhook Secret</label>
              <input style={input} value={cfg.whop_webhook_secret} onChange={e => set('whop_webhook_secret', e.target.value)} placeholder="whsec_xxxxxxxx" />
            </div>

            <div style={field}>
              <label style={label}>Exchange rate mode</label>
              <div style={toggleRow}>
                <div onClick={() => set('whop_rate_mode', 'fixed')} style={modeBtn(cfg.whop_rate_mode !== 'live')}>Fixed rate</div>
                <div onClick={() => set('whop_rate_mode', 'live')} style={modeBtn(cfg.whop_rate_mode === 'live')}>Live rate</div>
              </div>
              <div style={hint}>Fixed uses the rate you set below. Live fetches the current USD→PKR rate automatically.</div>
            </div>

            <div style={grid2}>
              {cfg.whop_rate_mode !== 'live' ? (
                <div style={field}>
                  <label style={label}>USD → PKR rate</label>
                  <input style={input} value={cfg.whop_exchange_rate} onChange={e => set('whop_exchange_rate', e.target.value)} placeholder="280" />
                </div>
              ) : null}
              <div style={field}>
                <label style={label}>Gateway fee (%)</label>
                <input style={input} value={cfg.whop_fee_percent} onChange={e => set('whop_fee_percent', e.target.value)} placeholder="10" />
              </div>
            </div>

            <div style={field}>
              <label style={label}>Whop product currency</label>
              <div style={toggleRow}>
                <div onClick={() => set('whop_currency', 'PKR')} style={modeBtn(cfg.whop_currency !== 'USD')}>PKR → USD</div>
                <div onClick={() => set('whop_currency', 'USD')} style={modeBtn(cfg.whop_currency === 'USD')}>USD as-is</div>
              </div>
              <div style={hint}>PKR: totals are converted to USD using the rate above. USD: charged directly (only the gateway fee is added).</div>
            </div>

            <div style={field}>
              <label style={label}>One-time payments provider</label>
              <div style={toggleRow}>
                <div onClick={() => set('route_oneoff', 'payfast')} style={modeBtn(cfg.route_oneoff !== 'whop')}>PayFast</div>
                <div onClick={() => set('route_oneoff', 'whop')} style={modeBtn(cfg.route_oneoff === 'whop')}>Whop</div>
              </div>
            </div>

            <div style={field}>
              <label style={label}>Subscriptions provider</label>
              <div style={toggleRow}>
                <div onClick={() => set('route_subscription', 'payfast')} style={modeBtn(cfg.route_subscription === 'payfast')}>PayFast</div>
                <div onClick={() => set('route_subscription', 'whop')} style={modeBtn(cfg.route_subscription !== 'payfast')}>Whop</div>
              </div>
              <div style={hint}>Checkout automatically uses the selected provider for each payment type.</div>
            </div>

            <div style={field}>
              <label style={label}>Whop webhook URL (paste into your Whop dashboard)</label>
              <div style={codeBox}>
                <span style={codeText}>{appUrl}/api/whop/webhook</span>
              </div>
            </div>
          </div>
        ) : null}

        <button onClick={save} disabled={saving || !locationId} style={saveBtn}>
          {saving ? 'Saving…' : saved ? '✓ Saved & Connected' : 'Save & Connect to HighLevel'}
        </button>

        {saved ? <div style={okMsg}>Configuration saved and connected to HighLevel.</div> : null}
        {error ? <div style={errMsg}>{error}</div> : null}
      </div>
    </main>
  );
}
