'use client';

import { useEffect, useMemo, useState } from 'react';

const card = {
  background: 'var(--dark2)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: 22,
} as const;

const input = {
  width: '100%',
  background: 'var(--dark3)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '11px 12px',
  color: 'white',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
} as const;

const area = {
  ...input,
  minHeight: 150,
  resize: 'vertical' as const,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export default function AgencyControls({ initialLocationId = '' }: { initialLocationId?: string }) {
  const [plans, setPlans] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [rebillingResult, setRebillingResult] = useState<any>(null);
  const [locations, setLocations] = useState<Array<{ locationId: string; name: string; businessName?: string; merchantName?: string; status?: string }>>([]);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [rebillingPayload, setRebillingPayload] = useState(`{
  "locationIds": [],
  "rebillingType": "monthly",
  "amount": 0
}`);
  const [enablePayload, setEnablePayload] = useState(`{
  "planId": "",
  "subscriptionId": ""
}`);
  const [updatePayload, setUpdatePayload] = useState(`{
  "subscriptionId": "",
  "amount": 0
}`);

  const formattedPlans = useMemo(() => (plans ? JSON.stringify(plans, null, 2) : ''), [plans]);
  const formattedSubscription = useMemo(() => (subscription ? JSON.stringify(subscription, null, 2) : ''), [subscription]);
  const formattedRebilling = useMemo(() => (rebillingResult ? JSON.stringify(rebillingResult, null, 2) : ''), [rebillingResult]);
  const filteredLocations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return locations;
    return locations.filter((loc) => {
      const haystack = [loc.name, loc.businessName, loc.merchantName, loc.locationId, loc.status].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [locations, search]);

  useEffect(() => {
    fetch('/api/agency/locations')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setLocations([]);
          return;
        }

        const unique = Array.from(
          new Map(data.filter((loc) => loc?.locationId).map((loc) => [loc.locationId, loc])).values()
        );
        setLocations(unique);
      })
      .catch(() => setLocations([]));
  }, []);

  async function run(key: string, url: string, options?: RequestInit) {
    setLoading(key);
    setMessage(null);
    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || data.message || 'Request failed' });
        return null;
      }
      setMessage({ type: 'success', text: 'Request completed successfully.' });
      return data;
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Request failed' });
      return null;
    } finally {
      setLoading(null);
    }
  }

  function parseJson(value: string) {
    return JSON.parse(value);
  }

  const infoCards = [
    {
      title: 'Agency SaaS Plans',
      desc: 'Load the plans configured in HighLevel for the connected agency.',
      action: () => run('plans', '/api/agency/saas/agency-plans').then((data) => data && setPlans(data)),
      cta: loading === 'plans' ? 'Loading…' : 'Load Plans',
      content: formattedPlans || 'Agency SaaS plan payload will appear here once loaded.',
    },
    {
      title: 'Location Subscription Lookup',
      desc: 'Fetch the live SaaS subscription metadata for a specific sub-account.',
      action: () => run('subscription', `/api/agency/saas/location-subscription?locationId=${encodeURIComponent(locationId)}`).then((data) => data && setSubscription(data)),
      cta: loading === 'subscription' ? 'Checking…' : 'Fetch Subscription',
      content: formattedSubscription || 'Subscription details will appear here after lookup.',
    },
    {
      title: 'Rebilling Cron',
      desc: 'Run the tokenized rebilling job manually or point your scheduler at the live endpoint.',
      action: () => run('rebilling-run', '/api/rebilling/run', { method: 'POST' }).then((data) => data && setRebillingResult(data)),
      cta: loading === 'rebilling-run' ? 'Running…' : 'Run Rebilling',
      content: formattedRebilling || 'POST /api/rebilling/run\nHeader: x-rebilling-secret: set REBILLING_SECRET on the server\n\nUse this endpoint from cron, GitHub Actions, or a server scheduler.',
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="mobile-stack-2">
        {infoCards.map((section) => (
          <section key={section.title} style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{section.title}</div>
                <div style={{ color: 'var(--gray)', fontSize: 13, lineHeight: 1.6 }}>{section.desc}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="Sub-account location ID" style={input} />
              <button onClick={section.action} style={{ background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 10, padding: '0 16px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>{section.cta}</button>
            </div>

            <div style={{ background: '#0A1229', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#9FB0D5', fontSize: 12 }}>{section.content}</pre>
            </div>
          </section>
        ))}
      </div>

      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Known Locations</div>
            <div style={{ color: 'var(--gray)', fontSize: 13, lineHeight: 1.6 }}>These are the installed locations saved in the portal, shown as name plus location ID.</div>
          </div>
        </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search business name or location ID"
          style={{ ...input, maxWidth: 380, flex: '1 1 260px' }}
        />
        <div style={{ alignSelf: 'center', color: 'var(--gray)', fontSize: 12 }}>
          {filteredLocations.length} location(s)
        </div>
      </div>

      <div className="mobile-stack-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {filteredLocations.length ? filteredLocations.map((loc) => (
            <button
              key={loc.locationId}
              onClick={() => setLocationId(loc.locationId)}
              style={{
                textAlign: 'left',
                background: locationId === loc.locationId ? 'rgba(0,82,255,0.18)' : 'var(--dark3)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 14px',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, lineHeight: 1.4 }}>{loc.businessName || loc.name}</div>
                {loc.status && (
                  <div style={{ fontSize: 11, color: '#7FB0FF', background: 'rgba(0,82,255,0.12)', border: '1px solid rgba(0,82,255,0.18)', borderRadius: 999, padding: '4px 8px', textTransform: 'capitalize' }}>
                    {loc.status}
                  </div>
                )}
              </div>
              {loc.merchantName && loc.merchantName !== loc.businessName && (
                <div style={{ fontSize: 12, color: '#9FB0D5', marginBottom: 4 }}>{loc.merchantName}</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--gray)', fontFamily: 'monospace' }}>{loc.locationId}</div>
            </button>
          )) : (
            <div style={{ color: 'var(--gray)', fontSize: 13 }}>No saved locations found yet.</div>
          )}
        </div>
      </section>

      <div className="mobile-stack-3">
        <section style={card}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Update Rebilling</div>
          <div style={{ color: 'var(--gray)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>Send a manual rebilling payload to the agency company context. Use this to align reseller billing with your HighLevel SaaS model.</div>
          <textarea value={rebillingPayload} onChange={(e) => setRebillingPayload(e.target.value)} style={area} />
          <button onClick={() => run('rebilling', '/api/agency/saas/rebilling', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: rebillingPayload })} style={{ marginTop: 12, width: '100%', background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', fontWeight: 700 }}>
            {loading === 'rebilling' ? 'Sending…' : 'Send Rebilling Request'}
          </button>
        </section>

        <section style={card}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Enable SaaS for Location</div>
          <div style={{ color: 'var(--gray)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>Enable SaaS against a sub-account after you decide which reseller setup or plan should apply.</div>
          <input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="Sub-account location ID" style={{ ...input, marginBottom: 10 }} />
          <textarea value={enablePayload} onChange={(e) => setEnablePayload(e.target.value)} style={{ ...area, minHeight: 120 }} />
          <button onClick={() => run('enable', '/api/agency/saas/enable-location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId, payload: parseJson(enablePayload) }) })} style={{ marginTop: 12, width: '100%', background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', fontWeight: 700 }}>
            {loading === 'enable' ? 'Enabling…' : 'Enable SaaS'}
          </button>
        </section>

        <section style={card}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Update or Pause Subscription</div>
          <div style={{ color: 'var(--gray)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>Use this when a monthly amount changes, a subscription needs updating, or a location must be paused for failed billing.</div>
          <input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="Sub-account location ID" style={{ ...input, marginBottom: 10 }} />
          <textarea value={updatePayload} onChange={(e) => setUpdatePayload(e.target.value)} style={{ ...area, minHeight: 120 }} />
          <div className="mobile-stack-2" style={{ marginTop: 12 }}>
            <button onClick={() => run('update', '/api/agency/saas/update-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId, payload: parseJson(updatePayload) }) })} style={{ background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', fontWeight: 700 }}>
              {loading === 'update' ? 'Updating…' : 'Update'}
            </button>
            <button onClick={() => run('pause', '/api/agency/saas/pause-location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId, payload: {} }) })} style={{ background: 'transparent', color: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', fontWeight: 700 }}>
              {loading === 'pause' ? 'Pausing…' : 'Pause'}
            </button>
          </div>
        </section>
      </div>

      {message && (
        <div style={{ background: message.type === 'success' ? 'rgba(0,82,255,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${message.type === 'success' ? 'rgba(0,82,255,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 12, padding: '12px 16px', color: message.type === 'success' ? '#3D7FFF' : '#EF4444' }}>
          {message.text}
        </div>
      )}
    </div>
  );
}
