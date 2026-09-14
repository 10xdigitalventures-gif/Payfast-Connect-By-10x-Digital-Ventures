'use client';

import { useEffect, useState, type CSSProperties } from 'react';

type Config = {
  merchant_id: string;
  merchant_name: string;
  store_id: string;
  merchant_key: string;
  passphrase: string;
  environment: 'live' | 'sandbox';
};

const empty: Config = { merchant_id: '', merchant_name: '', store_id: '', merchant_key: '', passphrase: '', environment: 'sandbox' };

export default function PayfastSettingsPage() {
  const [locationId, setLocationId] = useState('');
  const [config, setConfig] = useState<Config>(empty);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('locationId') || '';
    if (!id || id.includes('{')) {
      setError('Open this PayFast app from HighLevel Payments → Integrations.');
      setState('ready');
      return;
    }
    setLocationId(id);
    fetch(`/api/apps/payfast/config?locationId=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => { if (data?.installed) setConfig({ ...empty, ...data }); })
      .catch(() => setError('Could not load PayFast settings.'))
      .finally(() => setState('ready'));
  }, []);

  function set<K extends keyof Config>(key: K, value: Config[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!locationId) return;
    setState('saving');
    setError('');
    try {
      const response = await fetch('/api/apps/payfast/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, locationId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not save PayFast settings.');
      setState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save PayFast settings.');
      setState('ready');
    }
  }

  const field: CSSProperties = { display: 'grid', gap: 6 };
  const input: CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 8, padding: '11px 12px', fontSize: 14 };
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      <section style={{ maxWidth: 620, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28 }}>
        <h1 style={{ margin: 0 }}>PayFast Pakistan</h1>
        <p style={{ color: '#64748b' }}>This app is PayFast-only. Whop and Swich credentials are managed in their own apps.</p>

        <h2 style={{ fontSize: 15, marginTop: 28 }}>Environment</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['sandbox', 'live'] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => set('environment', mode)} style={{ flex: 1, padding: 11, borderRadius: 8, border: '1px solid #2563eb', background: config.environment === mode ? '#2563eb' : '#fff', color: config.environment === mode ? '#fff' : '#2563eb', fontWeight: 700 }}>
              {mode === 'live' ? 'Live' : 'Sandbox'}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
          <label style={field}>Merchant ID<input style={input} value={config.merchant_id} onChange={(e) => set('merchant_id', e.target.value)} /></label>
          <label style={field}>Merchant Key<input style={input} type="password" value={config.merchant_key} onChange={(e) => set('merchant_key', e.target.value)} /></label>
          <label style={field}>Merchant / Store Name<input style={input} value={config.merchant_name} onChange={(e) => set('merchant_name', e.target.value)} /></label>
          <label style={field}>Store ID (optional)<input style={input} value={config.store_id} onChange={(e) => set('store_id', e.target.value)} /></label>
          <label style={field}>Passphrase / Shared Secret (optional)<input style={input} type="password" value={config.passphrase} onChange={(e) => set('passphrase', e.target.value)} /></label>
        </div>

        <div style={{ marginTop: 24, padding: 12, borderRadius: 8, background: '#eff6ff', color: '#1e40af', fontSize: 13 }}>
          ITN/Webhook: {typeof window !== 'undefined' ? window.location.origin : ''}/api/payfast/itn
        </div>
        <button type="button" disabled={state === 'saving' || state === 'loading' || !locationId} onClick={save} style={{ width: '100%', marginTop: 20, border: 0, borderRadius: 9, padding: 13, background: '#2563eb', color: '#fff', fontWeight: 800 }}>
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved and connected' : 'Save PayFast settings'}
        </button>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      </section>
    </main>
  );
}
