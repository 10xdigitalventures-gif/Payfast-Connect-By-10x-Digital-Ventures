'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const SECTIONS = [
  { label: 'Overview', items: [
    { label: 'Dashboard',     href: '/dashboard',     icon: '📊' },
  ]},
  { label: 'Config', items: [
    { label: 'Settings',      href: '/settings',      icon: '⚙️' },
  ]},
  { label: 'Help', items: [
    { label: 'Docs',          href: '/docs',          icon: '📚' },
    { label: 'Support',       href: '/support',       icon: '💬' },
  ]},
];

export default function Sidebar() {
  const path = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [path]);

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        onClick={toggleSidebar}
        style={{ 
          display: 'none', 
          position: 'fixed', 
          top: 12, 
          left: 12, 
          zIndex: 1000, 
          background: 'var(--blue)', 
          color: 'white', 
          border: 'none', 
          borderRadius: 8, 
          width: 36, 
          height: 36, 
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}
        className="mobile-sidebar-toggle"
      >
        ☰
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          style={{ 
            display: 'none', 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.5)', 
            zIndex: 999, 
            backdropFilter: 'blur(2px)' 
          }}
          className="mobile-backdrop"
        />
      )}

      <aside style={{ 
        width: 220, 
        minHeight: '100vh', 
        background: 'var(--dark2)', 
        borderRight: '1px solid var(--border)', 
        padding: '20px 14px', 
        display: 'flex', 
        flexDirection: 'column', 
        flexShrink: 0, 
        position: 'sticky', 
        top: 0, 
        height: '100vh', 
        overflowY: 'auto',
        transition: 'transform 0.3s ease',
        zIndex: 1001
      }} 
      className={`sidebar-container ${isOpen ? 'open' : ''}`}
      >
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', marginBottom: 24, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, background: 'var(--blue)', borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13H11L10 22L19.5 11H13L13 2Z"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 13, color: 'white' }}>GoPayFast Connect</div>
            <div style={{ fontSize: 10, color: 'var(--gray)' }}>10x Digital Ventures</div>
          </div>
        </Link>

        {SECTIONS.map(sec => (
          <div key={sec.label}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gray)', padding: '0 8px', margin: '16px 0 6px' }}>{sec.label}</div>
            {sec.items.map(item => {
              const base = item.href.split('#')[0];
              const active = path === base || (base.length > 1 && path.startsWith(base));
              return (
                <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500, marginBottom: 1, transition: 'all .15s', textDecoration: 'none', background: active ? 'rgba(0,82,255,0.12)' : 'transparent', color: active ? '#3D7FFF' : 'var(--gray)' }}>
                      <span style={{ width: 16, fontSize: 13, textAlign: 'center' }}>{item.icon}</span>
                      {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 9, fontSize: 11, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, background: '#22C55E', borderRadius: '50%' }} />
            <span style={{ color: 'var(--gray)' }}>GoPayFast Connected</span>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 11, color: 'var(--gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Logout</button>
          </form>
        </div>
      </aside>
    </>
  );
}
