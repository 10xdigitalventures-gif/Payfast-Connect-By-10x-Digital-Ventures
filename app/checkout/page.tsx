'use client';
import { useEffect, useRef, useState } from 'react';

// HighLevel loads this page in an iframe (paymentsUrl) during customer
// checkout (funnels, invoices, payment links, subscriptions).
//
// Per official GHL docs:
//   1. We send  -> { type: 'custom_provider_ready', loaded: true, addCardOnFileSupported: true }
//   2. GHL sends -> { type: 'payment_initiate_props', amount, currency,
//                     transactionId, orderId, subscriptionId, locationId, contact, mode }
//   3. We charge via PayFast, then notify GHL on success/fail/cancel.

interface GHLPaymentData {
  amount:         number;
  currency:       string;
  contactId:      string;
  locationId:     string;
  invoiceId?:     string;
  orderId?:       string;
  subscriptionId?:string;
  transactionId:  string;
  description?:   string;
  mode?:          'payment' | 'setup';
  productDetails?:{ productId?: string; priceId?: string };
  contact?: {
    id?:    string;
    name:   string;
    email:  string;
    phone?: string;
    contact?: string;
  };
}

function readUrlPayData(): GHLPaymentData | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  const amount     = parseFloat(p.get('amount') || '');
  const locationId = p.get('locationId') || '';
  if (!amount || !locationId) return null;

  return {
    amount,
    currency:       p.get('currency') || 'PKR',
    contactId:      p.get('contactId') || '',
    locationId,
    invoiceId:      p.get('invoiceId')      || undefined,
    orderId:        p.get('orderId')        || undefined,
    subscriptionId: p.get('subscriptionId') || undefined,
    transactionId:  p.get('transactionId') || p.get('ghlTransactionId') || '',
    description:    p.get('description')   || undefined,
    contact: {
      name:  p.get('name')  || '',
      email: p.get('email') || '',
      phone: p.get('phone') || '',
    },
  };
}

export default function CheckoutPage() {
  const [payData,        setPayData]        = useState<GHLPaymentData | null>(null);
  const [form,           setForm]           = useState({ name: '', email: '', phone: '' });
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [pfForm,         setPfForm]         = useState<{ actionUrl: string; fields: Record<string, string> } | null>(null);
  const [waitingForGhl,  setWaitingForGhl]  = useState(true);
  const [debugMsg,       setDebugMsg]       = useState('');

  const payDataRef = useRef<GHLPaymentData | null>(null);

  useEffect(() => {
    const fromUrl = readUrlPayData();
    if (fromUrl) {
      setPayData(fromUrl);
      payDataRef.current = fromUrl;
      setWaitingForGhl(false);
      if (fromUrl.contact) {
        setForm({
          name:  fromUrl.contact.name  || '',
          email: fromUrl.contact.email || '',
          phone: fromUrl.contact.phone || fromUrl.contact.contact || '',
        });
      }
    }

    function handleMessage(event: MessageEvent) {
      const d = event.data;
      if (!d || typeof d !== 'object') return;

      const isPaymentInit =
        d.type === 'payment_initiate_props' ||
        d.type === 'payment-init' ||
        (typeof d.amount === 'number' && d.locationId);

      if (isPaymentInit) {
        const incoming: GHLPaymentData = {
          amount:         Number(d.amount),
          currency:       d.currency || 'PKR',
          contactId:      d.contact?.id || d.contactId || '',
          locationId:     d.locationId,
          invoiceId:      d.invoiceId,
          orderId:        d.orderId,
          subscriptionId: d.subscriptionId,
          transactionId:  d.transactionId || d.ghlTransactionId || '',
          description:    d.description,
          mode:           d.mode,
          productDetails: d.productDetails,
          contact:        d.contact,
        };
        setPayData(incoming);
        payDataRef.current = incoming;
        setWaitingForGhl(false);
        if (incoming.contact) {
          setForm({
            name:  incoming.contact.name  || '',
            email: incoming.contact.email || '',
            phone: incoming.contact.phone || incoming.contact.contact || '',
          });
        }
        setDebugMsg('');
      }
    }
    window.addEventListener('message', handleMessage);

    setTimeout(() => {
      try {
        window.parent.postMessage(
          { type: 'custom_provider_ready', loaded: true, addCardOnFileSupported: true },
          '*'
        );
      } catch { /* not in iframe */ }
    }, 50);

    const t = setTimeout(() => {
      if (!payDataRef.current) {
        setWaitingForGhl(false);
        setDebugMsg(
          'No payment context received from HighLevel. ' +
          'If you opened this URL directly, please return to your CRM and use the payment link/funnel/invoice button.'
        );
      }
    }, 6000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!pfForm) return;
    const frm = document.getElementById('pfSubmitForm') as HTMLFormElement | null;
    if (frm) setTimeout(() => frm.submit(), 400);
  }, [pfForm]);

  async function pay() {
    if (!payData) return;
    if (!form.email.includes('@')) { setError('Valid email required'); return; }
    if (!form.name.trim())         { setError('Name required'); return; }

    setLoading(true); setError('');

    try {
      const res = await fetch('/api/ghl/pay', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId:       payData.locationId,
          contactId:        payData.contactId,
          ghlTransactionId: payData.transactionId,
          invoiceId:        payData.invoiceId,
          orderId:          payData.orderId,
          subscriptionId:   payData.subscriptionId,
          amount:           payData.amount,
          currency:         payData.currency,
          description:      payData.description || 'Payment',
          nameFirst:        form.name.split(' ')[0],
          nameLast:         form.name.split(' ').slice(1).join(' ') || '.',
          email:            form.email,
          phone:            form.phone,
          isRecurring:      !!payData.subscriptionId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Payment initiation failed (${res.status})`);
      if (!data?.actionUrl || !data?.fields) throw new Error('Invalid payment response from server');

      try {
        window.parent.postMessage(
          { type: 'custom_element_success_response', chargeId: data.pf_payment_id || data.basket_id },
          '*'
        );
      } catch { /* ignore */ }

      setPfForm({ actionUrl: data.actionUrl, fields: data.fields });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      setError(msg);
      try {
        window.parent.postMessage(
          { type: 'custom_element_error_response', error: { description: msg } },
          '*'
        );
      } catch { /* ignore */ }
      setLoading(false);
    }
  }

  const inp = {
    width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0',
    borderRadius: 10, padding: '12px 16px', color: '#0F172A', fontSize: 14,
    outline: 'none', fontFamily: 'inherit',
  } as const;

  if (pfForm) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'grid', placeItems: 'center', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#0F172A' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p style={{ color: '#64748B', fontSize: 14 }}>Redirecting to GoPayFast secure checkout…</p>
          <form id="pfSubmitForm" action={pfForm.actionUrl} method="POST">
            {Object.entries(pfForm.fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          </form>
        </div>
      </div>
    );
  }

  if (waitingForGhl && !payData) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'grid', placeItems: 'center', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#64748B', fontSize: 14 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          Loading payment details…
        </div>
      </div>
    );
  }

  if (!payData) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'grid', placeItems: 'center', fontFamily: 'DM Sans, sans-serif', padding: 20 }}>
        <div style={{ textAlign: 'center', color: '#64748B', fontSize: 14, maxWidth: 440 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
          <p style={{ fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>Unable to load payment information.</p>
          <p style={{ marginBottom: 14 }}>
            {debugMsg || 'Please open this page inside the HighLevel checkout iframe.'}
          </p>
          <p style={{ fontSize: 12, color: '#94A3B8' }}>
            If this persists, check that Payfast Connect is set as Default in your CRM:<br />
            <strong>Payments → Integrations → Payfast Connect → Set as Default</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'DM Sans, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: '#0052FF', borderRadius: 7, display: 'grid', placeItems: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13H11L10 22L19.5 11H13Z"/></svg>
          </div>
          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 13, color: '#0F172A' }}>Secure Checkout</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B' }}>
          <span style={{ width: 6, height: 6, background: '#22C55E', borderRadius: '50%', display: 'inline-block' }} />
          SSL · GoPayFast
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 20px', maxWidth: 440, margin: '0 auto', width: '100%' }}>
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>
            {payData.description || (payData.subscriptionId ? 'Subscription Payment' : 'Amount Due')}
          </div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 32, fontWeight: 800, color: '#0052FF' }}>
            {payData.currency || 'PKR'} {Number(payData.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
          </div>
          {payData.subscriptionId && (
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
              Recurring subscription · Auto-charged
            </div>
          )}
        </div>

        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 14 }}>Your Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748B', marginBottom: 5, display: 'block' }}>Full Name *</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748B', marginBottom: 5, display: 'block' }}>Email *</label>
              <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748B', marginBottom: 5, display: 'block' }}>Phone</label>
              <input style={inp} type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+92 300 0000000" />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#EF4444', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button onClick={pay} disabled={loading} style={{ width: '100%', background: '#0052FF', color: 'white', border: 'none', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Processing…' : `Pay ${payData.currency || 'PKR'} ${Number(payData.amount).toLocaleString()} →`}
        </button>

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#94A3B8' }}>
          🔒 Secured by GoPayFast · 10x Digital Ventures
        </div>
      </div>
    </div>
  );
}