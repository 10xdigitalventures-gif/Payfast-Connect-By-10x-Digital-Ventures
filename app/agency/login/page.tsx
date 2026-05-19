'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AgencyLoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/agency-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Agency login failed');
      router.push('/agency');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell-dark" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
      <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, background: 'var(--blue)', borderRadius: 12, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13H11L10 22L19.5 11H13L13 2Z"/></svg>
        </div>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Agency Portal</h1>
        <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 24 }}>Secure access for Agency administrators</p>
        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 16 }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Agency Username</label>
            <input style={{ width: '100%', background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', color: 'white', outline: 'none' }} 
              value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: 12, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Password</label>
            <input style={{ width: '100%', background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', color: 'white', outline: 'none' }} 
              type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          {error && <div style={{ color: '#F87171', fontSize: 13, textAlign: 'center' }}>{error}</div>}
          <button disabled={loading} style={{ background: 'var(--blue)', color: 'white', border: 'none', padding: '12px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Verifying...' : 'Agency Login'}
          </button>
        </form>
        <div style={{ marginTop: 20, fontSize: 13, color: 'var(--gray)' }}>
          Contact your account manager for access.
        </div>
      </div>
    </div>
  );
}
