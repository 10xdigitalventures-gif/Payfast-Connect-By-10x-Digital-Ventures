'use client';

import { useState } from 'react';

const input = {
  width: '100%',
  background: 'white',
  border: '1px solid #D7E0EC',
  borderRadius: 10,
  padding: '12px 14px',
  color: '#0F172A',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
} as const;

const label = {
  fontSize: 12,
  color: '#64748B',
  marginBottom: 6,
  display: 'block',
  fontWeight: 600,
} as const;

const cities = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
  'Bahawalpur',
];

const pluginOptions = [
  'WooCommerce',
  'WordPress',
  'OpenCart',
  'Magento 2',
  'WHMCS',
  'PrestaShop',
  'CS-Cart MultiVendor',
  'Hotel Booking',
  'Shopify',
  'Custom Website / CRM',
];

export default function ApplyPage() {
  const [form, setForm] = useState({
    business_name: '',
    city: '',
    email: '',
    phone: '',
    username: '',
    full_name: '',
    id_number: '',
    business_type: 'other',
    registration_number: '',
    vat_number: '',
    website: '',
    business_category: '',
    monthly_turnover: '',
    business_description: '',
    address_line1: '',
    address_line2: '',
    province: '',
    postal_code: '',
    country: 'Pakistan',
    bank_name: '',
    account_holder: '',
    account_number: '',
    account_type: 'cheque',
    branch_code: '',
    ghl_location_id: '',
    payment_solution: 'CRM Payments',
    integration_platform: 'Custom Website / CRM',
    additional_information: '',
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setLoading(true);
    setError('');

    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to submit application');
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="page-shell-light" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 560, width: '100%', background: 'white', border: '1px solid #E2E8F0', borderRadius: 20, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, marginBottom: 10 }}>Merchant Details Submitted</h1>
          <p style={{ color: '#64748B', lineHeight: 1.6 }}>
            Your PayFast onboarding details have been saved. The team can now use these values to create the merchant account and continue the plugin setup.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-light" style={{ padding: '32px 20px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <div className="page-container">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 32, fontWeight: 800, color: '#0F172A' }}>PayFast Merchant Create Form</div>
          <div style={{ color: '#64748B', marginTop: 8 }}>
            The first section matches the PayFast partner merchant-create screen so you can collect the same details before account creation.
          </div>
        </div>

        <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 18, padding: 22, marginBottom: 18 }}>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 20, marginBottom: 16 }}>Register Merchant</h2>
          <div className="mobile-stack-2">
            <div>
              <label style={label}>Business Name (Display) *</label>
              <input style={input} value={form.business_name} onChange={(e) => set('business_name', e.target.value)} placeholder="10x Digital Ventures" />
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>(display name)</div>
            </div>
            <div>
              <label style={label}>City *</label>
              <select style={input} value={form.city} onChange={(e) => set('city', e.target.value)}>
                <option value="">Select City</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Email *</label>
              <input style={input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="merchant@example.com" />
            </div>
            <div>
              <label style={label}>Mobile *</label>
              <input style={input} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03XXXXXXXXX" />
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>(unique mobile number)</div>
            </div>
            <div>
              <label style={label}>Username *</label>
              <input style={input} value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="merchant.username" />
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>(used for partner/super-user login, must be unique)</div>
            </div>
            <div>
              <label style={label}>Primary Contact Name</label>
              <input style={input} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Owner / account manager" />
            </div>
            <div>
              <label style={label}>CNIC / ID Number</label>
              <input style={input} value={form.id_number} onChange={(e) => set('id_number', e.target.value)} placeholder="35202-1234567-8" />
            </div>
          </div>
        </section>

        <div className="mobile-stack-2">
          <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 18, padding: 22 }}>
            <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 18, marginBottom: 16 }}>Business Details</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Business Type</label>
              <select style={input} value={form.business_type} onChange={(e) => set('business_type', e.target.value)}>
                <option value="other">Other</option>
                <option value="sole_proprietor">Sole Proprietor</option>
                <option value="partnership">Partnership</option>
                <option value="pty_ltd">Pvt Ltd / Company</option>
                <option value="trust">Trust</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Website</label>
              <input style={input} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://example.com" />
            </div>
            <div className="mobile-stack-2" style={{ marginBottom: 14 }}>
              <div>
                <label style={label}>Registration Number</label>
                <input style={input} value={form.registration_number} onChange={(e) => set('registration_number', e.target.value)} placeholder="SECP / NTN / company reg no" />
              </div>
              <div>
                <label style={label}>VAT / Tax Number</label>
                <input style={input} value={form.vat_number} onChange={(e) => set('vat_number', e.target.value)} placeholder="If available" />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Business Category</label>
              <input style={input} value={form.business_category} onChange={(e) => set('business_category', e.target.value)} placeholder="Education, SaaS, Retail" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Monthly Turnover</label>
              <input style={input} value={form.monthly_turnover} onChange={(e) => set('monthly_turnover', e.target.value)} placeholder="Estimated monthly volume" />
            </div>
            <div>
              <label style={label}>Business Description</label>
              <textarea style={{ ...input, minHeight: 100, resize: 'vertical' }} value={form.business_description} onChange={(e) => set('business_description', e.target.value)} placeholder="What does the business sell or collect payments for?" />
            </div>
          </section>

          <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 18, padding: 22 }}>
            <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 18, marginBottom: 16 }}>Technical Integration</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Shopping Cart / Platform</label>
              <select style={input} value={form.integration_platform} onChange={(e) => set('integration_platform', e.target.value)}>
                {pluginOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>CRM Location ID</label>
              <input style={input} value={form.ghl_location_id} onChange={(e) => set('ghl_location_id', e.target.value)} placeholder="Optional sub-account / location id" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Payment Solution</label>
              <select style={input} value={form.payment_solution} onChange={(e) => set('payment_solution', e.target.value)}>
                <option value="CRM Payments">CRM Payments</option>
                <option value="Payment Links">Payment Links</option>
                <option value="Invoices">Invoices</option>
                <option value="All of the above">All of the above</option>
              </select>
            </div>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
              Plugin options are based on the PayFast partner plugins page. This gives you a clean place to record whether the merchant needs WooCommerce, Shopify, Magento, WHMCS, or a custom CRM integration.
            </div>
          </section>

          <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 18, padding: 22 }}>
            <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 18, marginBottom: 16 }}>Address</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Address Line 1</label>
              <input style={input} value={form.address_line1} onChange={(e) => set('address_line1', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Address Line 2</label>
              <input style={input} value={form.address_line2} onChange={(e) => set('address_line2', e.target.value)} />
            </div>
            <div className="mobile-stack-2">
              <div>
                <label style={label}>Province</label>
                <input style={input} value={form.province} onChange={(e) => set('province', e.target.value)} />
              </div>
              <div>
                <label style={label}>Postal Code</label>
                <input style={input} value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} />
              </div>
            </div>
          </section>

          <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 18, padding: 22 }}>
            <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 18, marginBottom: 16 }}>Banking & Notes</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Bank Name</label>
              <input style={input} value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Account Holder</label>
              <input style={input} value={form.account_holder} onChange={(e) => set('account_holder', e.target.value)} />
            </div>
            <div className="mobile-stack-2" style={{ marginBottom: 14 }}>
              <div>
                <label style={label}>Account Number</label>
                <input style={input} value={form.account_number} onChange={(e) => set('account_number', e.target.value)} />
              </div>
              <div>
                <label style={label}>Branch Code</label>
                <input style={input} value={form.branch_code} onChange={(e) => set('branch_code', e.target.value)} />
              </div>
            </div>
            <div>
              <label style={label}>Additional Information</label>
              <textarea style={{ ...input, minHeight: 100, resize: 'vertical' }} value={form.additional_information} onChange={(e) => set('additional_information', e.target.value)} placeholder="Anything needed for PayFast account creation or plugin setup" />
            </div>
          </section>
        </div>

        {error && (
          <div style={{ marginTop: 18, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', borderRadius: 12, padding: '12px 16px' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={submit} disabled={loading} style={{ background: '#28B7C8', color: 'white', border: 'none', padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Creating…' : 'Create Merchant Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
