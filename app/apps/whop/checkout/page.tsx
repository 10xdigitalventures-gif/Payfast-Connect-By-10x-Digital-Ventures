'use client';
import { useEffect, useRef, useState } from 'react';

type GhlContext = {
  locationId: string; publishableKey: string; amount: number; currency: string;
  mode: 'setup' | 'payment' | 'subscription'; isRecurring: boolean;
  frequency: string; intervalCount: number; contactId: string;
  name: string; email: string; transactionId: string; invoiceId: string;
  orderId: string; subscriptionId: string; description: string;
};
type Stage = 'loading' | 'ready' | 'waiting' | 'complete' | 'failed';

function expectedParentOrigin() {
  try { return document.referrer ? new URL(document.referrer).origin : '*'; }
  catch { return '*'; }
}
function tellHighLevel(data: Record<string, unknown>) {
  if (window.parent !== window) window.parent.postMessage(JSON.stringify(data), expectedParentOrigin());
}
function checkedWhopUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' || (url.hostname !== 'whop.com' && !url.hostname.endsWith('.whop.com'))) return null;
    return url.href;
  } catch { return null; }
}

export default function WhopCheckout() {
  const [context, setContext] = useState<GhlContext | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{ basketId: string; payToken: string } | null>(null);
  const popup = useRef<Window | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const origin = expectedParentOrigin();
    const ready = () => tellHighLevel({ type: 'custom_provider_ready', loaded: true, addCardOnFileSupported: true });
    const handler = (event: MessageEvent) => {
      if (event.source !== window.parent || (origin !== '*' && event.origin !== origin)) return;
      let data: any = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!['payment_initiate_props', 'setup_initiate_props'].includes(data?.type)) return;
      const setup = data.type === 'setup_initiate_props' || data.mode === 'setup';
      const amount = Number(data.amount);
      const locationId = String(data.locationId || '');
      const publishableKey = String(data.publishableKey || '');
      if (!/^[A-Za-z0-9_-]{1,255}$/.test(locationId) || !publishableKey ||
        (!setup && (!Number.isFinite(amount) || amount <= 0))) {
        setError('HighLevel did not supply valid Whop payment details.');
        setStage('failed');
        return;
      }
      const prices = Array.isArray(data.productDetails)
        ? data.productDetails.flatMap((product: any) => product?.prices || [])
        : [];
      const recurring = prices.find((price: any) => price?.type === 'recurring');
      const details = recurring?.recurring || data.recurring || {};
      const isRecurring = !setup && (!!data.subscriptionId || data.isRecurring === true ||
        data.mode === 'subscription' || !!recurring);
      const contact = data.contact || {};
      const next: GhlContext = {
        locationId, publishableKey, amount: setup ? 0 : amount,
        currency: String(data.currency || 'USD').toUpperCase(),
        mode: setup ? 'setup' : isRecurring ? 'subscription' : 'payment',
        isRecurring, frequency: String(details.interval || data.frequency || data.interval || ''),
        intervalCount: Number(details.intervalCount || data.intervalCount || 1),
        contactId: String(contact.id || data.contactId || ''),
        name: String(contact.name || ''), email: String(contact.email || ''),
        transactionId: String(data.transactionId || data.ghlTransactionId || ''),
        invoiceId: String(data.invoiceId || ''), orderId: String(data.orderId || ''),
        subscriptionId: String(data.subscriptionId || ''),
        description: String(data.description || ''),
      };
      setContext(next); setName(next.name); setEmail(next.email);
      setError(''); setReceipt(null); setStage('ready'); done.current = false;
    };
    window.addEventListener('message', handler);
    ready();
    const interval = window.setInterval(ready, 750);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setStage(previous => previous === 'loading' ? 'failed' : previous);
    }, 15000);
    return () => { window.removeEventListener('message', handler); window.clearInterval(interval); window.clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (!receipt || !context || stage !== 'waiting') return;
    let cancelled = false, busy = false;
    const deadline = Date.now() + 10 * 60 * 1000;
    const check = async () => {
      if (cancelled || busy || done.current) return;
      if (Date.now() > deadline) {
        done.current = true; setStage('failed');
        setError('Whop confirmation timed out. Check the payment record before retrying.');
        tellHighLevel({ type: 'custom_element_error_response', error: { description: 'Whop payment status timed out.' } });
        return;
      }
      busy = true;
      try {
        const params = new URLSearchParams({ ...receipt, locationId: context.locationId });
        const response = await fetch('/api/apps/whop/status?' + params.toString(), { cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json();
        if (result.status === 'paid' || result.status === 'failed') {
          done.current = true;
          if (result.status === 'paid') {
            setStage('complete');
            tellHighLevel({ type: 'custom_element_success_response', chargeId: result.chargeId || receipt.basketId });
          } else {
            setStage('failed'); setError('Whop declined or could not complete this payment.');
            tellHighLevel({ type: 'custom_element_error_response', error: { description: 'Whop payment failed.' } });
          }
        }
      } catch { /* retry temporary network problems */ }
      finally { busy = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(), 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [receipt, context, stage]);

  async function start() {
    if (!context || stage !== 'ready') return;
    if (!email.includes('@') || (context.mode === 'setup' && !context.contactId)) {
      setError('Valid customer email and contact ID are required.'); return;
    }
    const opened = window.open('about:blank', 'whopHostedCheckout', 'width=520,height=740');
    if (!opened) { setError('Please allow popups and try again.'); return; }
    popup.current = opened; done.current = false;
    setError(''); setStage('waiting');
    try {
      const response = await fetch(context.mode === 'setup' ? '/api/apps/whop/setup' : '/api/apps/whop/pay', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...context, ghlTransactionId: context.transactionId,
          name, email, nameFirst: name.trim().split(/\s+/)[0] || '',
          nameLast: name.trim().split(/\s+/).slice(1).join(' '),
        }),
      });
      const data = await response.json().catch(() => ({}));
      const redirectUrl = checkedWhopUrl(data?.redirectUrl);
      if (!response.ok || !redirectUrl || !data.basketId || !data.payToken)
        throw new Error(data?.error || 'Unable to start Whop checkout.');
      setReceipt({ basketId: String(data.basketId), payToken: String(data.payToken) });
      opened.location.href = redirectUrl;
    } catch (err) {
      opened.close(); setStage('ready');
      setError(err instanceof Error ? err.message : 'Unable to start Whop checkout.');
    }
  }
  function cancel() {
    if (done.current) return;
    done.current = true; popup.current?.close();
    setReceipt(null); setStage('ready');
    tellHighLevel({ type: 'custom_element_close_response' });
  }

  return <main style={{ minHeight: '100vh', padding: 24, display: 'grid', placeItems: 'center', background: '#f8fafc', fontFamily: 'system-ui' }}>
    <section style={{ width: 'min(460px,100%)', padding: 28, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0' }}>
      <h1>Whop Secure Checkout</h1>
      {stage === 'loading' ? <p>Connecting to HighLevel…</p> : null}
      {stage === 'complete' ? <p>Payment confirmed by Whop.</p> : null}
      {stage === 'failed' ? <p>Payment not confirmed.</p> : null}
      {context && (stage === 'ready' || stage === 'waiting') ? <>
        <p style={{ fontSize: 22, fontWeight: 700 }}>{context.mode === 'setup' ? 'Save a card on file' : context.currency + ' ' + context.amount.toFixed(2)}</p>
        {context.isRecurring ? <p>This is a recurring Whop subscription.</p> : null}
        <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>Full name
          <input value={name} onChange={e => setName(e.target.value)} disabled={stage === 'waiting'} style={{ padding: 10 }} />
        </label>
        <label style={{ display: 'grid', gap: 6, marginBottom: 14 }}>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={stage === 'waiting'} style={{ padding: 10 }} />
        </label>
        <button onClick={() => void start()} disabled={stage === 'waiting'} style={{ width: '100%', padding: 13, background: '#2563eb', border: 0, borderRadius: 8, color: 'white', fontWeight: 700 }}>
          {stage === 'waiting' ? 'Waiting for Whop confirmation…' : context.mode === 'setup' ? 'Add card with Whop' : 'Pay with Whop'}
        </button>
        {stage === 'waiting' ? <button onClick={cancel} style={{ marginTop: 12, background: 'transparent', border: 0 }}>Cancel</button> : null}
      </> : null}
      {error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : null}
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 24 }}>A verified Whop webhook is required to confirm payment.</p>
    </section>
  </main>;
}
