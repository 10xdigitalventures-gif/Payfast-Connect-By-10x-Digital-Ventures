'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function login() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Login failed');
      setLoading(false);
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <div className="page-shell-dark" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', maxWidth: 420, background: 'white', borderRadius: 18, padding: 22 }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, marginBottom: 12 }}>Admin Access</h1>
        <p style={{ color: '#64748B', marginBottom: 14 }}>Enter the admin password to review merchant applications.</p>
        <input style={{ width: '100%', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', color: '#0F172A', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter admin password" />
        {error && <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', color: '#EF4444', fontSize: 13 }}>{error}</div>}
        <button onClick={login} disabled={loading} style={{ marginTop: 14, width: '100%', background: '#0052FF', color: 'white', border: 'none', padding: '12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, opacity: loading ? 0.6 : 1 }}>{loading ? 'Unlocking…' : 'Unlock'}</button>
      </div>
    </div>
  );
}
