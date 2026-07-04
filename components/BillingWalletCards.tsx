'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PaymentInstrument } from '@/lib/payment-instruments';
import type { WalletBalance } from '@/lib/wallet';

interface Props {
  wallet: WalletBalance;
  instruments: PaymentInstrument[];
  payfastReady: boolean;
}

export default function BillingWalletCards({ wallet, instruments, payfastReady }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState('1000');
  const [saveCardForm, setSaveCardForm] = useState({ nameFirst: '', nameLast: '', email: '', phone: '' });
  const [payFastForm, setPayFastForm] = useState<{ actionUrl: string; fields: Record<string, string> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function topUpWallet() {
    setBusy('wallet');
    setError('');

    try {
      const res = await fetch('/api/billing/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to top up wallet');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to top up wallet');
    } finally {
      setBusy(null);
    }
  }

  async function startSaveCard() {
    if (!payfastReady) {
      setError('Connect agency PayFast credentials before saving cards.');
      return;
    }

    setBusy('save-card');
    setError('');

    try {
      const res = await fetch('/api/billing/save-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveCardForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to prepare card save flow');
      setPayFastForm({ actionUrl: data.actionUrl, fields: data.fields });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to prepare card save flow');
    } finally {
      setBusy(null);
    }
  }

  async function setDefault(id: number) {
    setBusy(`default-${id}`);
    setError('');

    try {
      const res = await fetch(`/api/billing/payment-methods/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-default' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to update default card');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update default card');
    } finally {
      setBusy(null);
    }
  }

  async function removeCard(id: number) {
    setBusy(`remove-${id}`);
    setError('');

    try {
      const res = await fetch(`/api/billing/payment-methods/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to remove card');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove card');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="resp-padding mobile-stack-2" style={{ paddingTop: 0, paddingBottom: 32 }}>
      <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700 }}>Wallet Balance</div>
            <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>Maintain balance for sub-account billing and internal charges.</div>
          </div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, color: '#3D7FFF' }}>
            {wallet.currency} {Number(wallet.balance).toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            style={{ width: 160, background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none' }}
            placeholder="Amount"
          />
          <button
            onClick={topUpWallet}
            disabled={busy === 'wallet'}
            style={{ background: 'var(--blue)', color: 'white', border: 'none', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy === 'wallet' ? 0.7 : 1 }}
          >
            {busy === 'wallet' ? 'Adding...' : 'Add Balance'}
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--gray)', lineHeight: 1.7 }}>
          Wallet top-up is currently a manual balance adjustment inside this portal. If you want, I can connect this button to a real PayFast funding flow next.
        </div>
      </div>

      <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Saved Payment Methods</div>
        <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 16, lineHeight: 1.7 }}>
          Cards saved through PayFast tokenization will appear here for default billing and rebilling.
        </div>

        {!payFastForm ? (
          <div style={{ background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Save a new card</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
              <input value={saveCardForm.nameFirst} onChange={(e) => setSaveCardForm((s) => ({ ...s, nameFirst: e.target.value }))} placeholder="First name" style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none' }} />
              <input value={saveCardForm.nameLast} onChange={(e) => setSaveCardForm((s) => ({ ...s, nameLast: e.target.value }))} placeholder="Last name" style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
              <input value={saveCardForm.email} onChange={(e) => setSaveCardForm((s) => ({ ...s, email: e.target.value }))} placeholder="Email" style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none' }} />
              <input value={saveCardForm.phone} onChange={(e) => setSaveCardForm((s) => ({ ...s, phone: e.target.value }))} placeholder="Mobile" style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none' }} />
            </div>
            <button onClick={startSaveCard} disabled={busy === 'save-card' || !payfastReady} style={{ background: 'var(--blue)', color: 'white', border: 'none', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy === 'save-card' || !payfastReady ? 0.7 : 1 }}>
              {busy === 'save-card' ? 'Preparing...' : !payfastReady ? 'PayFast Not Connected' : 'Save Card With PayFast'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 8, lineHeight: 1.6 }}>
              This starts a small verification charge so PayFast can return a reusable token for rebilling.
            </div>
          </div>
        ) : (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>PayFast form ready</div>
            <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 12 }}>Continue to PayFast to verify and save this card.</div>
            <form action={payFastForm.actionUrl} method="POST" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {Object.entries(payFastForm.fields).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <button type="submit" style={{ background: 'var(--blue)', color: 'white', border: 'none', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Continue to PayFast
              </button>
              <button type="button" onClick={() => setPayFastForm(null)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--gray)', padding: '10px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                Back
              </button>
            </form>
          </div>
        )}

        {instruments.length === 0 ? (
          <div style={{ background: 'var(--dark3)', border: '1px dashed var(--border)', borderRadius: 12, padding: 16, color: 'var(--gray)', fontSize: 13, lineHeight: 1.7 }}>
            No saved cards yet. Once the tokenization flow stores a permanent PayFast instrument token, it will show up here.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {instruments.map((item) => {
              const masked = item.card_last_four ? `**** ${item.card_last_four}` : 'Tokenized instrument';
              const alias = item.instrument_alias || 'Saved card';

              return (
                <div key={item.id} style={{ background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{alias}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>
                        {masked}{item.expiry_date ? ` • Exp ${item.expiry_date}` : ''}{item.is_default ? ' • Default' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setDefault(item.id)}
                        disabled={!!item.is_default || busy === `default-${item.id}`}
                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--gray)', padding: '8px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer', opacity: !!item.is_default ? 0.5 : 1 }}
                      >
                        {busy === `default-${item.id}` ? 'Saving...' : 'Set Default'}
                      </button>
                      <button
                        onClick={() => removeCard(item.id)}
                        disabled={busy === `remove-${item.id}`}
                        style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', padding: '8px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
                      >
                        {busy === `remove-${item.id}` ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div style={{ gridColumn: '1 / -1', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', color: '#F87171', fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}
