'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * HighLevel Custom Payment Provider — Checkout Iframe
 *
 * Spec reference: GHL Custom Payment Provider docs
 *
 *   STEP 1 — On iframe load we dispatch:
 *     { type: 'custom_provider_ready', loaded: true, addCardOnFileSupported: true }
 *
 *   STEP 2 — GHL replies with:
 *     { type: 'payment_initiate_props', amount, currency, transactionId,
 *       orderId, subscriptionId, locationId, contact, mode }
 *
 *   STEP 3 — User submits the form. We:
 *     a) Hit our backend /api/ghl/pay to create a pending payment row
 *        and build a PayFast hosted-checkout form.
 *     b) Open PayFast in a NEW WINDOW (popup) so the iframe stays alive.
 *     c) Begin polling /api/ghl/payment-status?token=... every 2s.
 *
 *   STEP 4 — On a terminal state we dispatch EXACTLY ONE of:
 *     success      -> { type: 'custom_element_success_response', chargeId }
 *     failure      -> { type: 'custom_element_error_response', error: { description } }
 *     cancellation -> { type: 'custom_element_close_response' }
 */

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

type Stage = 'waiting_ghl' | 'no_data' | 'form' | 'awaiting_payment' | 'completed' | 'failed' | 'cancelled';

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

function makeOnce() {
  let fired = false;
  return (fn: () => void) => {
    if (fired) return;
    fired = true;
    try { fn(); } catch { /* ignore */ }
  };
}

export default function CheckoutPage() {
  const [payData, setPayData] = useState<GHLPaymentData | null>(null);
  const [form,    setForm]    = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [stage,   setStage]   = useState<Stage>('waiting_ghl');
  const [pollMessage] = useState('Complete payment in the new window…');

  const payDataRef   = useRef<GHLPaymentData | null>(null);
  const pfWindowRef  = useRef<Window | null>(null);
  const payTokenRef  = useRef<string>('');
  const pollTimerRef  = useRef<number | null>(null);
  const popupWatchRef = useRef<number | null>(null);
  const notifyOnce = useRef(makeOnce()).current;

  // 1) Bootstrap
  useEffect(() => {
    const fromUrl = readUrlPayData();
    if (fromUrl) {
      setPayData(fromUrl);
      payDataRef.current = fromUrl;
      setStage('form');
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
        setStage('form');
        if (incoming.contact) {
          setForm({
            name:  incoming.contact.name  || '',
            email: incoming.contact.email || '',
            phone: incoming.contact.phone || incoming.contact.contact || '',
          });
        }
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

    const timeoutId = window.setTimeout(() => {
      if (!payDataRef.current) setStage('no_data');
    }, 6000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
      if (pollTimerRef.current)  window.clearInterval(pollTimerRef.current);
      if (popupWatchRef.current) window.clearInterval(popupWatchRef.current);
    };
  }, []);

  // 2) Polling
  function startPolling(payToken: string) {
    payTokenRef.current = payToken;
    let attempts = 0;
    const MAX_ATTEMPTS = 300; // 10 minutes at 2s

    pollTimerRef.current = window.setInterval(async () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        stopPolling();
        notifyError('Payment timed out. Please try again.');
        return;
      }
      try {
        const res = await fetch(`/api/ghl/payment-status?token=${encodeURIComponent(payToken)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'complete') {
          stopPolling();
          notifySuccess(data.chargeId || payToken);
        } else if (data.status === 'failed') {
          stopPolling();
          notifyError(data.message || 'Payment failed at gateway');
        } else if (data.status === 'cancelled') {
          stopPolling();
          notifyCancel();
        }
      } catch { /* network blip */ }
    }, 2000);
  }

  function stopPolling() {
    if (pollTimerRef.current)  { window.clearInterval(pollTimerRef.current);  pollTimerRef.current  = null; }
    if (popupWatchRef.current) { window.clearInterval(popupWatchRef.current); popupWatchRef.current = null; }
  }

  // 3) Notify CRM (each fires once)
  function notifySuccess(chargeId: string) {
    notifyOnce(() => {
      setStage('completed');
      try { window.parent.postMessage({ type: 'custom_element_success_response', chargeId }, '*'); } catch {}
    });
  }
  function notifyError(description: string) {
    notifyOnce(() => {
      setStage('failed');
      setError(description);
      try { window.parent.postMessage({ type: 'custom_element_error_response', error: { description } }, '*'); } catch {}
    });
  }
  function notifyCancel() {
    notifyOnce(() => {
      setStage('cancelled');
      try { window.parent.postMessage({ type: 'custom_element_close_response' }, '*'); } catch {}
    });
  }

  // 4) Pay handler
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
      if (!data?.actionUrl || !data?.fields || !data?.payToken) {
        throw new Error('Invalid payment response from server');
      }

      const popup = window.open('', 'gopayfast_checkout', 'width=520,height=720');
      if (!popup) {
        throw new Error('Pop-up blocked. Please allow pop-ups for this site and try again.');
      }
      pfWindowRef.current = popup;

      const inputs = Object.entries(data.fields as Record<string, string>)
        .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`)
        .join('');

      popup.document.write(`
        <!doctype html>
        <html><head><meta charset="utf-8"><title>Redirecting to GoPayFast…</title>
          <style>
            body { font-family: system-ui, sans-serif; display: grid; place-items: center;
                   min-height: 100vh; margin: 0; background: #F8FAFC; color: #0F172A; }
            .box { text-align: center; }
            .spinner { font-size: 28px; margin-bottom: 10px; }
          </style>
        </head><body>
          <div class="box">
            <div class="spinner">⏳</div>
            <p>Redirecting to GoPayFast secure checkout…</p>
          </div>
          <form id="f" action="${data.actionUrl}" method="POST">${inputs}</form>
          <script>document.getElementById('f').submit();</script>
        </body></html>
      `);
      popup.document.close();

      setStage('awaiting_payment');
      startPolling(data.payToken);

      popupWatchRef.current = window.setInterval(() => {
        if (popup.closed && pollTimerRef.current) {
          window.clearInterval(popupWatchRef.current!);
          popupWatchRef.current = null;
          setTimeout(async () => {
            try {
              const r = await fetch(`/api/ghl/payment-status?token=${encodeURIComponent(payTokenRef.current)}`);
              const d = await r.json();
              if (d.status === 'complete')      { stopPolling(); notifySuccess(d.chargeId || payTokenRef.current); }
              else if (d.status === 'failed')   { stopPolling(); notifyError(d.message || 'Payment failed'); }
              else                              { stopPolling(); notifyCancel(); }
            } catch {
              stopPolling(); notifyCancel();
            }
          }, 5000);
        }
      }, 1000);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      setError(msg);
      setLoading(false);
    }
  }

  function userCancelClicked() {
    if (pfWindowRef.current && !pfWindowRef.current.closed) {
      pfWindowRef.current.close();
    }
    stopPolling();
    notifyCancel();
  }

  const inp = {
    width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0',
    borderRadius: 10, padding: '12px 16px', color: '#0F172A', fontSize: 14,
    outline: 'none', fontFamily: 'inherit',
  } as const;

  // RENDER
  if (stage === 'waiting_ghl' && !payData) {
    return (
      <Shell>
        <Center>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ color: '#64748B', fontSize: 14 }}>Loading payment details…</div>
        </Center>
      </Shell>
    );
  }

  if (stage === 'no_data') {
    return (
      <Shell>
        <Center>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: '#0F172A', fontWeight: 600, marginBottom: 8 }}>Unable to load payment information</div>
          <div style={{ color: '#64748B', fontSize: 13, maxWidth: 380 }}>
            Please open this page inside the HighLevel checkout iframe.<br />
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              Verify Payfast Connect is set as Default in your CRM under Payments → Integrations.
            </span>
          </div>
        </Center>
      </Shell>
    );
  }

  if (stage === 'awaiting_payment') {
    return (
      <Shell>
        <Center>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
          <div style={{ color: '#0F172A', fontWeight: 600, marginBottom: 6 }}>{pollMessage}</div>
          <div style={{ color: '#64748B', fontSize: 12, maxWidth: 360, marginBottom: 18 }}>
            Don&apos;t close this window. Once payment is confirmed you&apos;ll be returned automatically.
          </div>
          <button
            onClick={userCancelClicked}
            style={{ background: 'transparent', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', color: '#64748B', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel payment
          </button>
        </Center>
      </Shell>
    );
  }

  if (stage === 'completed') {
    return (
      <Shell>
        <Center>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Payment Successful</div>
          <div style={{ color: '#64748B', fontSize: 13 }}>Returning to your CRM…</div>
        </Center>
      </Shell>
    );
  }

  if (stage === 'failed') {
    return (
      <Shell>
        <Center>
          <div style={{ fontSize: 36, marginBottom: 12 }}>❌</div>
          <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Payment Failed</div>
          <div style={{ color: '#EF4444', fontSize: 13, maxWidth: 360 }}>{error || 'Please try again or use a different method.'}</div>
        </Center>
      </Shell>
    );
  }

  if (stage === 'cancelled') {
    return (
      <Shell>
        <Center>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🚫</div>
          <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Payment Cancelled</div>
          <div style={{ color: '#64748B', fontSize: 13 }}>No charge was made.</div>
        </Center>
      </Shell>
    );
  }

  // Form
  return (
    <Shell>
      <div style={{ flex: 1, padding: '24px 20px', maxWidth: 440, margin: '0 auto', width: '100%' }}>
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>
            {payData!.description || (payData!.subscriptionId ? 'Subscription Payment' : 'Amount Due')}
          </div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 32, fontWeight: 800, color: '#0052FF' }}>
            {payData!.currency || 'PKR'} {Number(payData!.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
          </div>
          {payData!.subscriptionId && (
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
          {loading ? 'Processing…' : `Pay ${payData!.currency || 'PKR'} ${Number(payData!.amount).toLocaleString()} →`}
        </button>

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#94A3B8' }}>
          🔒 Secured by GoPayFast · 10x Digital Ventures
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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
      {children}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center' }}>{children}</div>
    </div>
  );
}