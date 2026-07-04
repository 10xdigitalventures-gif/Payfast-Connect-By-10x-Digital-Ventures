 'use client';

import { useEffect, useState } from 'react';

interface Application {
  id: number;
  status: string;
  full_name: string;
  username: string | null;
  id_number: string | null;
  email: string;
  phone: string;
  business_name: string;
  business_type: string | null;
  registration_number: string | null;
  vat_number: string | null;
  website: string | null;
  business_category: string | null;
  monthly_turnover: string | null;
  business_description: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  bank_name: string | null;
  account_holder: string | null;
  account_number: string | null;
  account_type: string | null;
  branch_code: string | null;
  ghl_location_id: string | null;
  integration_platform: string | null;
  pf_merchant_id: string | null;
  pf_merchant_key: string | null;
  pf_passphrase: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const input = { width: '100%', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', color: '#0F172A', fontSize: 13, outline: 'none', fontFamily: 'inherit' } as const;
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 } as const;
const section = { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16 } as const;
const readValue = { fontSize: 14, color: '#0F172A', lineHeight: 1.6, wordBreak: 'break-word' as const };

export default function AdminPage() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [list, setList] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/applications?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then(setList)
      .finally(() => setLoading(false));
  }, [status, search]);

  function open(app: Application) {
    setSelected(app);
    setForm({
      status: app.status,
      pf_merchant_id: app.pf_merchant_id || '',
      pf_merchant_key: app.pf_merchant_key || '',
      pf_passphrase: app.pf_passphrase || '',
      admin_notes: app.admin_notes || '',
      rejection_reason: app.rejection_reason || '',
      reviewed_by: 'admin',
    });
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/admin/applications/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setSelected(null);
      setForm(null);
      const refreshed = await fetch(`/api/admin/applications?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`).then((r) => r.json());
      setList(refreshed);
    }
    setSaving(false);
  }

  function show(value?: string | null) {
    return value && String(value).trim() ? value : '—';
  }

  return (
    <div className="page-shell-light" style={{ padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 30, color: '#0F172A' }}>Merchant Applications</h1>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select style={{ ...input, width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All Statuses</option><option value="pending">Pending</option><option value="reviewing">Reviewing</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="live">Live</option></select>
            <input style={{ ...input, width: 240 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search applications" />
            <button onClick={async () => { await fetch('/api/admin/logout', { method: 'POST' }); window.location.href = '/admin/login'; }} style={{ background: '#0F172A', color: 'white', border: 'none', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}>Logout</button>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1.4fr 1.4fr 1fr 1fr 160px', gap: 12, padding: '14px 18px', background: '#F8FAFC', fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>
            <div>ID</div><div>Applicant</div><div>Business</div><div>Phone</div><div>CRM Location</div><div>Status</div>
          </div>
          {loading ? <div style={{ padding: 28 }}>Loading…</div> : list.map((app) => (
            <button key={app.id} onClick={() => open(app)} style={{ width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: '80px 1.4fr 1.4fr 1fr 1fr 160px', gap: 12, padding: '16px 18px', background: 'white', border: 'none', borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}>
              <div>#{app.id}</div><div><div style={{ fontWeight: 700 }}>{app.full_name}</div><div style={{ color: '#64748B', fontSize: 12 }}>{app.email}</div></div><div>{app.business_name}</div><div>{app.phone}</div><div>{app.ghl_location_id || '—'}</div><div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{app.status}</div>
            </button>
          ))}
          {!loading && list.length === 0 && <div style={{ padding: 28, color: '#64748B' }}>No applications found for the current filters.</div>}
          </div>
          </div>
        </div>
      </div>

      {selected && form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 760, background: 'white', borderRadius: 20, padding: 20, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}><h2 style={{ fontFamily: 'var(--font-head)', fontSize: 24 }}>Application #{selected.id}</h2><button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button></div>
            <div className="mobile-stack-2" style={{ marginBottom: 18 }}>
              {[
                ['Applicant', selected.full_name],
                ['Business', selected.business_name],
                ['Platform', show(selected.integration_platform)],
                ['CRM Location', show(selected.ghl_location_id)],
              ].map(([title, value]) => (
                <div key={title} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="mobile-stack-2">
              <div style={section}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, marginBottom: 14 }}>Applicant Details</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><div style={label}>Full Name</div><div style={readValue}>{show(selected.full_name)}</div></div>
                  <div><div style={label}>Username</div><div style={readValue}>{show(selected.username)}</div></div>
                  <div><div style={label}>ID Number</div><div style={readValue}>{show(selected.id_number)}</div></div>
                  <div><div style={label}>Email</div><div style={readValue}>{show(selected.email)}</div></div>
                  <div><div style={label}>Phone</div><div style={readValue}>{show(selected.phone)}</div></div>
                  <div><div style={label}>Submitted</div><div style={readValue}>{new Date(selected.created_at).toLocaleString()}</div></div>
                </div>
              </div>

              <div style={section}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, marginBottom: 14 }}>Business & Agency Signup</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><div style={label}>Business Name</div><div style={readValue}>{show(selected.business_name)}</div></div>
                  <div><div style={label}>Business Type</div><div style={readValue}>{show(selected.business_type)}</div></div>
                  <div><div style={label}>Registration Number</div><div style={readValue}>{show(selected.registration_number)}</div></div>
                  <div><div style={label}>VAT Number</div><div style={readValue}>{show(selected.vat_number)}</div></div>
                  <div><div style={label}>Website</div><div style={readValue}>{show(selected.website)}</div></div>
                  <div><div style={label}>Business Category</div><div style={readValue}>{show(selected.business_category)}</div></div>
                  <div><div style={label}>Monthly Turnover</div><div style={readValue}>{show(selected.monthly_turnover)}</div></div>
                  <div><div style={label}>Integration Platform</div><div style={readValue}>{show(selected.integration_platform)}</div></div>
                  <div><div style={label}>CRM Location ID</div><div style={readValue}>{show(selected.ghl_location_id)}</div></div>
                  <div><div style={label}>Business Description</div><div style={readValue}>{show(selected.business_description)}</div></div>
                </div>
              </div>

              <div style={section}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, marginBottom: 14 }}>Address & Banking</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><div style={label}>Address Line 1</div><div style={readValue}>{show(selected.address_line1)}</div></div>
                  <div><div style={label}>Address Line 2</div><div style={readValue}>{show(selected.address_line2)}</div></div>
                  <div><div style={label}>City / Province</div><div style={readValue}>{[selected.city, selected.province].filter(Boolean).join(', ') || '—'}</div></div>
                  <div><div style={label}>Postal Code</div><div style={readValue}>{show(selected.postal_code)}</div></div>
                  <div><div style={label}>Country</div><div style={readValue}>{show(selected.country)}</div></div>
                  <div><div style={label}>Bank Name</div><div style={readValue}>{show(selected.bank_name)}</div></div>
                  <div><div style={label}>Account Holder</div><div style={readValue}>{show(selected.account_holder)}</div></div>
                  <div><div style={label}>Account Number</div><div style={readValue}>{show(selected.account_number)}</div></div>
                  <div><div style={label}>Account Type</div><div style={readValue}>{show(selected.account_type)}</div></div>
                  <div><div style={label}>Branch Code</div><div style={readValue}>{show(selected.branch_code)}</div></div>
                </div>
              </div>

              <div style={section}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, marginBottom: 14 }}>Admin Review</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><label style={label}>Status</label><select style={input} value={form.status} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}><option value="pending">Pending</option><option value="reviewing">Reviewing</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="live">Live</option></select></div>
                  <div><label style={label}>Reviewed By</label><input style={input} value={form.reviewed_by} onChange={(e) => setForm((f: any) => ({ ...f, reviewed_by: e.target.value }))} /></div>
                  <div><label style={label}>Store ID</label><input style={input} value={form.pf_merchant_id} onChange={(e) => setForm((f: any) => ({ ...f, pf_merchant_id: e.target.value }))} /></div>
                  <div><label style={label}>Store Password</label><input style={input} value={form.pf_merchant_key} onChange={(e) => setForm((f: any) => ({ ...f, pf_merchant_key: e.target.value }))} /></div>
                  <div><label style={label}>Passphrase</label><input style={input} value={form.pf_passphrase} onChange={(e) => setForm((f: any) => ({ ...f, pf_passphrase: e.target.value }))} /></div>
                  <div><div style={label}>Last Reviewed</div><div style={readValue}>{selected.reviewed_at ? new Date(selected.reviewed_at).toLocaleString() : '—'}</div></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={label}>Admin Notes</label><textarea style={{ ...input, minHeight: 90, resize: 'vertical' }} value={form.admin_notes} onChange={(e) => setForm((f: any) => ({ ...f, admin_notes: e.target.value }))} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={label}>Rejection Reason</label><textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={form.rejection_reason} onChange={(e) => setForm((f: any) => ({ ...f, rejection_reason: e.target.value }))} /></div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setSelected(null)} style={{ background: '#E2E8F0', color: '#0F172A', border: 'none', padding: '12px 16px', borderRadius: 10, cursor: 'pointer' }}>Close</button>
              <button onClick={save} disabled={saving} style={{ background: '#0052FF', color: 'white', border: 'none', padding: '12px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
