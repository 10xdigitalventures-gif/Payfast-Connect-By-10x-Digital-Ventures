export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InstalledPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const locationId = typeof sp.locationId === 'string' ? sp.locationId : '';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        padding: '2rem',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          background: '#1e293b',
          borderRadius: '16px',
          padding: '3rem 2.5rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          textAlign: 'center',
          border: '1px solid #334155',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: '#10b981',
            margin: '0 auto 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
          Installation completed successfully
        </h1>

        <p style={{ color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
          Your PayFast payment provider is now registered with HighLevel.
        </p>

        <div
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '10px',
            padding: '1.25rem',
            textAlign: 'left',
            margin: '0 0 1.5rem',
          }}
        >
          <p
            style={{
              fontSize: '0.85rem',
              color: '#94a3b8',
              margin: '0 0 0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Next Step
          </p>
          <p style={{ margin: 0, lineHeight: 1.6, color: '#e2e8f0' }}>
            Go to{' '}
            <strong style={{ color: '#fff' }}>
              HighLevel &rarr; Payments &rarr; Settings &rarr; Integrations
            </strong>
            , find <strong style={{ color: '#fff' }}>PayFast</strong>, and click{' '}
            <strong style={{ color: '#fff' }}>Connect</strong> to enter your merchant
            credentials.
          </p>
        </div>

        {locationId ? (
          <p
            style={{
              fontSize: '0.75rem',
              color: '#64748b',
              margin: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            Location: {locationId}
          </p>
        ) : null}

        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '1.5rem 0 0' }}>
          You can safely close this window.
        </p>
      </div>
    </main>
  );
}
