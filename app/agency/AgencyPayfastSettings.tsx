'use client';

import { useEffect, useState } from 'react';

const input = { width: '100%', background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 10,
  padding: '11px 12px', color: 'white', fontSize: 13, fontFamily: 'inherit', outline: 'none' } as const;

const initial = {
  merchant_name: '', store_id: '', merchant_id: '', merchant_key: '', passphrase: '',
  sandbox_merchant_name: '', sandbox_store_id: '', sandbox_merchant_id: '', sandbox_merchant_key: '', sandbox_passphrase: '',
  environment: 'sandbox', route_subscription: 'payfast', notify_email: '', terms_url: '', privacy_policy_url: '',
  swich_live_client_id: '', swich_live_secret_key: '', swich_live_checkout_url: '',
  swich_sandbox_client_id: '', swich_sandbox_secret_key: '', swich_sandbox_checkout_url: '',
  has_merchant_key: false, has_sandbox_merchant_key: false, has_swich_live_secret_key: false, has_swich_sandbox_secret_key: false,
};

export default function AgencyPayfastSettings() {
  const [form, setForm] = useState<any>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { fetch('/api/agency/settings').then((r) => r.json()).then((data) => data && setForm((f: any) => ({ ...f, ...data }))).catch(() => {}); }, []);
  const set = (name: string, value: string) => setForm((f: any) => ({ ...f, [name]: value }));
  async function save() {
    setSaving(true); setMessage('');
    try { const res = await fetch('/api/agency/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setMessage(`Saved. ${data.provider} is active in ${data.environment} mode.`);
      const fresh = await fetch('/api/agency/settings').then((r) => r.json()); if (fresh) setForm((f: any) => ({ ...f, ...fresh }));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Failed to save settings'); } finally { setSaving(false); }
  }
  const secretPlaceholder = (saved: boolean) => saved ? 'Saved — leave blank to keep' : 'Enter secret';
  const field = (name: string, placeholder: string, type = 'text') => <input type={type} value={form[name] || ''} onChange={(e) => set(name, e.target.value)} placeholder={placeholder} style={input} />;

  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 18, padding: 22 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Gateway routing</div>
      <div style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 12 }}>Choose the active gateway and environment. Sandbox never uses live credentials.</div>
      <div className="mobile-stack-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <select value={form.route_subscription} onChange={(e) => set('route_subscription', e.target.value)} style={input}>
          <option value="payfast">PayFast Pakistan</option><option value="swich">Swich Pakistan</option><option value="whop">Whop</option>
        </select>
        <select value={form.environment} onChange={(e) => set('environment', e.target.value)} style={input}>
          <option value="sandbox">Sandbox / UAT</option><option value="live">Live</option>
        </select>
      </div>
    </div>

    <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 18, padding: 22 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>PayFast Pakistan — Live</div>
      <div className="mobile-stack-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        {field('merchant_name','Live merchant name')}{field('store_id','Live Store ID')}{field('merchant_id','Live Merchant ID')}
        {field('merchant_key',secretPlaceholder(form.has_merchant_key),'password')}{field('passphrase','Live passphrase (optional)','password')}
      </div>
    </div>

    <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 18, padding: 22 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>PayFast Pakistan — Sandbox / UAT</div>
      <div style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 12 }}>Uses ipguat.apps.net.pk. Keep test credentials separate from production.</div>
      <div className="mobile-stack-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        {field('sandbox_merchant_name','Sandbox merchant name')}{field('sandbox_store_id','Sandbox Store ID')}{field('sandbox_merchant_id','Sandbox Merchant ID')}
        {field('sandbox_merchant_key',secretPlaceholder(form.has_sandbox_merchant_key),'password')}{field('sandbox_passphrase','Sandbox passphrase (optional)','password')}
      </div>
    </div>

    <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 18, padding: 22 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Swich Pakistan</div>
      <div style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 12 }}>Enter the hosted checkout URLs and credentials supplied by Swich onboarding.</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Live</div>
      <div className="mobile-stack-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginBottom: 14 }}>
        {field('swich_live_client_id','Live Client ID')}{field('swich_live_secret_key',secretPlaceholder(form.has_swich_live_secret_key),'password')}{field('swich_live_checkout_url','Live hosted checkout URL')}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Sandbox</div>
      <div className="mobile-stack-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        {field('swich_sandbox_client_id','Sandbox Client ID')}{field('swich_sandbox_secret_key',secretPlaceholder(form.has_swich_sandbox_secret_key),'password')}{field('swich_sandbox_checkout_url','Sandbox hosted checkout URL')}
      </div>
    </div>

    <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 18, padding: 22 }}>
      <div className="mobile-stack-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginBottom: 12 }}>
        {field('notify_email','Notification email')}{field('terms_url','Terms & Conditions URL')}{field('privacy_policy_url','Privacy Policy URL')}
      </div>
      <button onClick={save} disabled={saving} style={{ background: 'var(--blue)', color: 'white', border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', opacity: saving ? .6 : 1 }}>
        {saving ? 'Saving…' : 'Save gateway settings'}
      </button>
      {message && <div style={{ marginTop: 12, color: '#9FB0D5', fontSize: 13 }}>{message}</div>}
    </div>
  </div>;
}
