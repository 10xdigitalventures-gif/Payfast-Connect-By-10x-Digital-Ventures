'use client';

import { useEffect, useState } from 'react';

export default function AdminBillingPage() {
  const [data, setData] = useState<{ rows: any[]; stats: any } | null>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/billing').then((r) => r.json()).then(setData);
    fetch('/api/admin/billing/settings').then((r) => r.json()).then(setSettings);
  }, []);

  async function saveSettings() {
    await fetch('/api/admin/billing/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    alert('Billing settings saved');
  }

  async function action(locationId: string, type: 'suspend' | 'activate') {
    await fetch(`/api/admin/billing/${locationId}/${type}`, { method: 'POST' });
    const refreshed = await fetch('/api/admin/billing').then((r) => r.json());
    setData(refreshed);
  }

  return (
    <div className="page-shell-light" style={{ padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <div className="page-container" style={{ display: 'grid', gap: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 30, color: '#0F172A' }}>Agency Billing</h1>
          <p style={{ color: '#64748B' }}>Overview of client subscriptions and agency billing settings.</p>
        </div>

        {data?.stats && (
          <div className="mobile-stack-3" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
            {[
              ['MRR', `PKR ${Number(data.stats.mrr || 0).toLocaleString()}`],
              ['Active', data.stats.active_count || 0],
              ['Trial', data.stats.trial_count || 0],
              ['Suspended', data.stats.suspended_count || 0],
              ['Cancelled', data.stats.cancelled_count || 0],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 20, marginBottom: 14 }}>Agency Billing Settings</div>
          {settings && <div className="mobile-stack-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {[
              ['merchant_name', 'merchant name', 'text'],
              ['merchant_id', 'merchant id', 'text'],
              ['merchant_key', 'merchant key', 'password'],
              ['store_id', 'store id', 'text'],
              ['passphrase', 'passphrase', 'password'],
              ['notify_email', 'notify email', 'text'],
            ].map(([key, placeholder, type]) => (
              <input key={key} type={type as string} value={settings[key] || ''} onChange={(e) => setSettings((s: any) => ({ ...s, [key]: e.target.value }))} placeholder={placeholder as string} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px' }} />
            ))}
            <input value={settings.trial_days || 14} onChange={(e) => setSettings((s: any) => ({ ...s, trial_days: e.target.value }))} placeholder="trial_days" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px' }} />
            <input value={settings.grace_period_days || 3} onChange={(e) => setSettings((s: any) => ({ ...s, grace_period_days: e.target.value }))} placeholder="grace_period_days" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px' }} />
            <select value={settings.environment || 'live'} onChange={(e) => setSettings((s: any) => ({ ...s, environment: e.target.value }))} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px' }}><option value="live">live</option><option value="sandbox">sandbox</option></select>
          </div>}
          <button onClick={saveSettings} style={{ marginTop: 14, background: '#0052FF', color: 'white', border: 'none', padding: '10px 16px', borderRadius: 10, cursor: 'pointer' }}>Save Billing Settings</button>
        </div>

        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 160px', gap: 12, padding: '14px 18px', background: '#F8FAFC', fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>
            <div>Location</div><div>Plan</div><div>Status</div><div>Last Invoice</div><div>Actions</div>
          </div>
          {data?.rows?.map((row) => (
            <div key={row.location_id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 160px', gap: 12, padding: '16px 18px', borderTop: '1px solid #F1F5F9', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{row.merchant_name || 'Unnamed location'}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{row.location_id}</div>
              </div>
              <div>{row.plan_name || 'Trial'}</div>
              <div style={{ textTransform: 'capitalize' }}>{row.status}</div>
              <div>{row.last_invoice_status || '—'}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => action(row.location_id, 'suspend')} style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#EF4444', padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>Suspend</button>
                <button onClick={() => action(row.location_id, 'activate')} style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#16A34A', padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>Activate</button>
              </div>
            </div>
          ))}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
