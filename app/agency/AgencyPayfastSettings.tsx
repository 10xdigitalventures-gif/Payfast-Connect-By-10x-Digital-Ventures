'use client';

import { useEffect, useState } from 'react';

const input = {
  width: '100%',
  background: 'var(--dark3)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '11px 12px',
  color: 'white',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
} as const;

export default function AgencyPayfastSettings() {
  const [form, setForm] = useState({
    merchant_name: '',
    store_id: '',
    merchant_id: '',
    merchant_key: '',
    passphrase: '',
    environment: 'live',
    notify_email: '',
    terms_url: '',
    privacy_policy_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/agency/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setForm({
            merchant_name: data.merchant_name || '',
            store_id: data.store_id || '',
            merchant_id: data.merchant_id || '',
            merchant_key: data.merchant_key || '',
            passphrase: data.passphrase || '',
            environment: data.environment || 'live',
            notify_email: data.notify_email || '',
            terms_url: data.terms_url || '',
            privacy_policy_url: data.privacy_policy_url || '',
          });
        }
      })
      .catch(() => {});
    // fetch agency context (company id) and update connect link
    fetch('/api/agency/context')
      .then((r) => r.json())
      .then((ctx) => {
        const link = document.getElementById('payfast-connect-link') as HTMLAnchorElement | null;
        if (ctx?.companyId && link) {
          link.href = `/api/agency/payfast/connect/start?companyId=${encodeURIComponent(ctx.companyId)}`;
        }
      })
      .catch(() => {});

    // Check URL query params for connect result and display message
    try {
      const qp = new URLSearchParams(window.location.search);
      if (qp.get('payfast_connected')) {
        setMessage('PayFast connected successfully.');
        // remove query params from URL without reloading
        const url = new URL(window.location.href);
        url.searchParams.delete('payfast_connected');
        window.history.replaceState({}, '', url.toString());
      } else if (qp.get('payfast_error')) {
        setMessage(decodeURIComponent(qp.get('payfast_error') || 'Unknown error'));
        const url = new URL(window.location.href);
        url.searchParams.delete('payfast_error');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {
      // ignore
    }
  }, []);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/agency/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || 'Failed to save settings');
        return;
      }
      setMessage('Agency PayFast credentials saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  const ready = Boolean(form.merchant_id && form.merchant_key);

  return (
    <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 18, padding: 22 }}>
      <div className="mobile-stack-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 12 }}>
        <input value={form.merchant_name} onChange={(e) => setForm((f) => ({ ...f, merchant_name: e.target.value }))} placeholder="Merchant name" style={input} />
        <input value={form.store_id} onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))} placeholder="Store ID" style={input} />
        <input value={form.merchant_id} onChange={(e) => setForm((f) => ({ ...f, merchant_id: e.target.value }))} placeholder="Merchant ID" style={input} />
        <input value={form.merchant_key} onChange={(e) => setForm((f) => ({ ...f, merchant_key: e.target.value }))} placeholder="Merchant Key" style={input} />
        <input value={form.passphrase} onChange={(e) => setForm((f) => ({ ...f, passphrase: e.target.value }))} placeholder="Passphrase" style={input} />
        <input value={form.notify_email} onChange={(e) => setForm((f) => ({ ...f, notify_email: e.target.value }))} placeholder="Notification email" style={input} />
        <select value={form.environment} onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))} style={input}>
          <option value="live">Live</option>
          <option value="sandbox">Sandbox</option>
        </select>
      </div>

      <div style={{ background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Terms & Conditions and Privacy Policy</div>
        <div className="mobile-stack-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <input value={form.terms_url} onChange={(e) => setForm((f) => ({ ...f, terms_url: e.target.value }))} placeholder="Terms & Conditions URL" style={input} />
          <input value={form.privacy_policy_url} onChange={(e) => setForm((f) => ({ ...f, privacy_policy_url: e.target.value }))} placeholder="Privacy Policy URL" style={input} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--gray)', lineHeight: 1.6 }}>
          {ready ? 'Credentials ready for agency billing.' : 'Connect merchant ID and key before collecting agency payments.'}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={save} disabled={saving} style={{ background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 10, padding: '11px 16px', cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save PayFast Settings'}
          </button>
          <a id="payfast-connect-link" href={`/api/agency/payfast/connect/start?companyId=default`} style={{ textDecoration: 'none' }}>
            <button style={{ background: 'transparent', color: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 16px', cursor: 'pointer', fontWeight: 700 }}>
              Connect PayFast (Agency)
            </button>
          </a>
        </div>
      </div>
      {message && <div style={{ marginTop: 12, fontSize: 13, color: '#9FB0D5' }}>{message}</div>}
    </div>
  );
}
