'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

interface Settings {
  merchant_name:       string;
  store_id:            string;
  merchant_id:         string;
  merchant_key:        string;
  passphrase:          string;
  environment:         string;
  tag_on_payment:      string;
  tag_on_fail:         string;
  move_opp_stage:      string;
  auto_create_contact: boolean;
  fire_workflow:       boolean;
  whop_enabled?:       boolean;
  whop_api_key?:       string;
  whop_company_id?:    string;
  whop_webhook_secret?: string;
  whop_exchange_rate?: string;
  whop_fee_percent?:   string;
  whop_rate_mode?:     string;
  whop_currency?:      string;
  route_oneoff?:       string;
  route_subscription?: string;
  login_username?:     string;
  login_password?:     string;
}

export default function SettingsPage() {
  const [cfg,     setCfg]     = useState<Settings>({ merchant_name: '', store_id: '', merchant_id: '', merchant_key: '', passphrase: '', environment: 'live', tag_on_payment: 'paid,customer', tag_on_fail: 'payment-failed', move_opp_stage: 'won', auto_create_contact: true, fire_workflow: true, whop_enabled: false, whop_api_key: '', whop_company_id: '', whop_webhook_secret: '', whop_exchange_rate: '280', whop_fee_percent: '10', whop_rate_mode: 'fixed', whop_currency: 'PKR', route_oneoff: 'payfast', route_subscription: 'whop' });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');
  const [tab,     setTab]     = useState<'payfast' | 'whop' | 'ghl' | 'webhooks' | 'login'>('payfast');
  const [installed, setInstalled] = useState(false);
  const [loginCreds, setLoginCreds] = useState<{username: string, password: string} | null>(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => { if (d) setCfg({ ...cfg, ...d }); }).catch(() => {});
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setInstalled(params.get('installed') === '1');
      const u = params.get('username');
      const p = params.get('password');
      if (u && p) {
        const creds = { username: u, password: p };
        setLoginCreds(creds);
        sessionStorage.setItem('pf_install_login_creds', JSON.stringify(creds));
        setTab('login'); // Auto-switch to login tab
      } else {
        const stored = sessionStorage.getItem('pf_install_login_creds');
        if (stored) {
          try {
            const creds = JSON.parse(stored);
            if (creds?.username && creds?.password) {
              setLoginCreds(creds);
              setTab('login');
            }
          } catch {}
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loginCreds && cfg.login_username && cfg.login_password) {
      setLoginCreds({ username: cfg.login_username, password: cfg.login_password });
      setTab('login');
    }
  }, [cfg.login_username, cfg.login_password, loginCreds]);

  const set = (k: keyof Settings, v: string | boolean) => setCfg(c => ({ ...c, [k]: v }));

  async function save() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) { setError('Failed to save. Please try again.'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  const inp = (style?: object) => ({
    width: '100%', background: 'var(--dark3)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '11px 16px', color: 'white', fontSize: 13,
    outline: 'none', fontFamily: 'inherit', ...style,
  });
  const lbl = { fontSize: 13, color: 'var(--gray)', marginBottom: 8, display: 'block' as const };
  const sec = { background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, marginBottom: 20 };

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const whopTitle = { fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 600, marginBottom: 4 } as const;
  const whopDesc = { fontSize: 13, color: 'var(--gray)', marginBottom: 24, lineHeight: 1.6 } as const;
  const whopToggle = { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 24 } as const;
  const whopCheckbox = { width: 18, height: 18, accentColor: '#2563EB', cursor: 'pointer' } as const;
  const whopToggleText = { fontSize: 14, color: 'white' } as const;
  const whopGrid = { display: 'grid', gap: 18 } as const;
  const whopFieldRow = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } as const;
  const whopHint = { fontSize: 12, color: 'var(--gray)', marginTop: 6 } as const;
  const whopModeRow = { display: 'flex', gap: 8, marginBottom: 4 } as const;
  const whopModeBtn = (active: boolean) => ({ flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textAlign: 'center' as const, background: active ? 'var(--blue)' : 'var(--dark3)', color: active ? '#fff' : 'var(--gray)', border: active ? '1px solid var(--blue)' : '1px solid var(--border)', transition: 'all 0.2s ease' });
  const whopBox = { marginTop: 22, padding: 16, background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 10 } as const;
  const whopBoxLabel = { fontSize: 12, color: 'var(--gray)', marginBottom: 6 } as const;
  const whopCode = { fontSize: 12, color: '#60A5FA', wordBreak: 'break-all' } as const;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="resp-padding" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700 }}>Settings</h2>
            <p style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>GoPayFast credentials &amp; CRM automation config</p>
          </div>
          <button onClick={save} disabled={saving}
            style={{ background: 'var(--blue)', color: 'white', border: 'none', padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>

        <div className="resp-padding" style={{ maxWidth: 760 }}>
          {installed && (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#22C55E', marginBottom: 18 }}>
              Install successful. Save your payment gateway fields below to activate GoPayFast for this CRM location.
            </div>
          )}

          {saved && (
            <div style={{ background: 'rgba(0,82,255,0.08)', border: '1px solid rgba(0,82,255,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#3D7FFF', marginBottom: 18 }}>
              Settings saved successfully.
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--dark2)', border: '1px solid var(--border)', padding: 4, borderRadius: 10, marginBottom: 28, width: 'fit-content' }}>
            {([['payfast', 'GoPayFast'], ['whop', 'Whop'], ['ghl', 'CRM Rules'], ['webhooks', 'Webhooks'], ['login', 'Login']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ padding: '8px 20px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: tab === k ? 'var(--blue)' : 'transparent', color: tab === k ? 'white' : 'var(--gray)' }}>
                {label}
              </button>
            ))}
          </div>

          {/* GoPayFast Tab */}
          {tab === 'payfast' && (
            <div style={sec}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>GoPayFast Credentials</div>
              <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 24, lineHeight: 1.5 }}>
                Enter the main GoPayFast gateway credentials here. These are the live values used by the hosted checkout flow.
              </div>
              <div className="mobile-stack-2" style={{ marginBottom: 16 }}>
                <div>
                  <label style={lbl}>Merchant Name</label>
                  <input style={inp()} value={cfg.merchant_name} onChange={e => set('merchant_name', e.target.value)} placeholder="Mentoring Hub" />
                </div>
                <div>
                  <label style={lbl}>Store ID</label>
                  <input style={inp()} value={cfg.store_id} onChange={e => set('store_id', e.target.value)} placeholder="Store ID" />
                </div>
              </div>
              <div className="mobile-stack-2" style={{ marginBottom: 16 }}>
                <div>
                  <label style={lbl}>Merchant ID *</label>
                  <input style={inp()} value={cfg.merchant_id} onChange={e => set('merchant_id', e.target.value)} placeholder="26290" />
                </div>
                <div>
                  <label style={lbl}>Merchant Secured Key *</label>
                  <input style={inp()} value={cfg.merchant_key} onChange={e => set('merchant_key', e.target.value)} placeholder="Merchant secured key" />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Merchant Secret Word</label>
                <input style={inp()} type="password" value={cfg.passphrase} onChange={e => set('passphrase', e.target.value)} placeholder="Leave blank if not set" />
                <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 6 }}>Use this only if GoPayFast issued an additional signing secret for your account.</div>
              </div>
              <div style={{ background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: 'var(--gray)', lineHeight: 1.7 }}>
                If your provider also gave you a separate <strong style={{ color: 'white' }}>Merchant Name</strong> or <strong style={{ color: 'white' }}>Store ID</strong>, keep them for reference. This hosted integration currently uses the three credentials above for payment requests and signature validation.
              </div>
              <div>
                <label style={lbl}>Environment</label>
                <select style={inp({ cursor: 'pointer', appearance: 'none' }) as object} value={cfg.environment} onChange={e => set('environment', e.target.value)}>
                  <option value="live">🟢 Live (Production)</option>
                  <option value="sandbox">🟡 Sandbox (Testing)</option>
                </select>
              </div>
            </div>
          )}

          {/* CRM Rules Tab */}
          {tab === 'whop' && (
            <div style={sec}>
              <div style={whopTitle}>Whop Payments</div>
              <div style={whopDesc}>
                Accept card, BNPL &amp; crypto payments via Whop. Whop charges in USD, so the PKR order total is converted using the rate below (plus an optional gateway fee). Payment is confirmed by a secure Whop webhook.
              </div>

              <label style={whopToggle}>
                <input
                  type="checkbox"
                  checked={!!cfg.whop_enabled}
                  onChange={e => set('whop_enabled', e.target.checked)}
                  style={whopCheckbox}
                />
                <span style={whopToggleText}>Enable Whop as a payment option at checkout</span>
              </label>

              <div style={whopGrid}>
                <div>
                  <label style={lbl}>Whop API Key *</label>
                  <input style={inp()} type="password" value={cfg.whop_api_key || ''} onChange={e => set('whop_api_key', e.target.value)} placeholder="Whop API key" />
                </div>
                <div>
                  <label style={lbl}>Company ID *</label>
                  <input style={inp()} value={cfg.whop_company_id || ''} onChange={e => set('whop_company_id', e.target.value)} placeholder="biz_xxxxxxxx" />
                </div>
                <div>
                  <label style={lbl}>Webhook Secret *</label>
                  <input style={inp()} type="password" value={cfg.whop_webhook_secret || ''} onChange={e => set('whop_webhook_secret', e.target.value)} placeholder="whsec_..." />
                  <div style={whopHint}>Copy this from the Whop dashboard webhook settings. Without it, webhooks are rejected for security.</div>
                </div>
                <div>
                  <label style={lbl}>Exchange rate mode</label>
                  <div style={whopModeRow}>
                    <div onClick={() => set('whop_rate_mode', 'fixed')} style={whopModeBtn((cfg.whop_rate_mode || 'fixed') === 'fixed')}>Fixed rate</div>
                    <div onClick={() => set('whop_rate_mode', 'live')} style={whopModeBtn((cfg.whop_rate_mode || 'fixed') === 'live')}>Live rate</div>
                  </div>
                  <div style={whopHint}>{(cfg.whop_rate_mode || 'fixed') === 'live' ? 'Live: the PKR to USD rate is fetched automatically at checkout (the rate below is used as a fallback).' : 'Fixed: the rate below is always used to convert PKR to USD.'}</div>
                </div>

                <div style={whopFieldRow}>
                  <div>
                    <label style={lbl}>PKR &rarr; USD rate</label>
                    <input style={inp()} value={cfg.whop_exchange_rate || ''} onChange={e => set('whop_exchange_rate', e.target.value)} placeholder="280" />
                    <div style={whopHint}>How many PKR = 1 USD.</div>
                  </div>
                  <div>
                    <label style={lbl}>Gateway fee (%)</label>
                    <input style={inp()} value={cfg.whop_fee_percent || ''} onChange={e => set('whop_fee_percent', e.target.value)} placeholder="0" />
                    <div style={whopHint}>Added on top of the order total.</div>
                  </div>
                </div>
              </div>

              <div style={whopBox}>
                <div style={whopBoxLabel}>Payment routing &mdash; choose which provider handles each type</div>

                <label style={lbl}>One-time payments</label>
                <div style={whopModeRow}>
                  <div onClick={() => set('route_oneoff', 'payfast')} style={whopModeBtn((cfg.route_oneoff || 'payfast') === 'payfast')}>PayFast</div>
                  <div onClick={() => set('route_oneoff', 'whop')} style={whopModeBtn((cfg.route_oneoff || 'payfast') === 'whop')}>Whop</div>
                </div>

                <label style={lbl}>Subscriptions</label>
                <div style={whopModeRow}>
                  <div onClick={() => set('route_subscription', 'payfast')} style={whopModeBtn((cfg.route_subscription || 'whop') === 'payfast')}>PayFast</div>
                  <div onClick={() => set('route_subscription', 'whop')} style={whopModeBtn((cfg.route_subscription || 'whop') === 'whop')}>Whop</div>
                </div>
                <div style={whopHint}>Checkout automatically uses the selected provider for each payment type.</div>

                <label style={lbl}>Whop product currency</label>
                <div style={whopModeRow}>
                  <div onClick={() => set('whop_currency', 'PKR')} style={whopModeBtn((cfg.whop_currency || 'PKR') === 'PKR')}>PKR &rarr; USD</div>
                  <div onClick={() => set('whop_currency', 'USD')} style={whopModeBtn((cfg.whop_currency || 'PKR') === 'USD')}>USD as-is</div>
                </div>
                <div style={whopHint}>PKR: totals are converted to USD using the rate above. USD: the amount is charged directly (only the gateway fee is added).</div>
              </div>

              <div style={whopBox}>
                <div style={whopBoxLabel}>Webhook URL (paste into your Whop dashboard):</div>
                <code style={whopCode}>{appUrl}/api/whop/webhook</code>
              </div>
            </div>
          )}

          {tab === 'ghl' && (
            <div style={sec}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>CRM Automation Rules</div>
              <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 24 }}>
                Configure what happens in your CRM when GoPayFast sends a payment notification.
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Tags to add on successful payment</label>
                <input style={inp()} value={cfg.tag_on_payment} onChange={e => set('tag_on_payment', e.target.value)} placeholder="paid,customer,active" />
                <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 6 }}>Comma-separated. Tags are auto-created in your CRM if they don&apos;t exist.</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Tags to add on failed payment</label>
                <input style={inp()} value={cfg.tag_on_fail} onChange={e => set('tag_on_fail', e.target.value)} placeholder="payment-failed" />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>Move opportunity stage to</label>
                <input style={inp()} value={cfg.move_opp_stage} onChange={e => set('move_opp_stage', e.target.value)} placeholder="won" />
                <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 6 }}>Leave blank to not move opportunities. Must match stage name exactly in your CRM.</div>
              </div>

              {/* Toggles */}
              {[
                { key: 'auto_create_contact' as const, title: 'Auto-create contact if not found', desc: 'Creates a new CRM contact when the payer email doesn\'t exist' },
                { key: 'fire_workflow' as const,       title: 'Fire CRM workflow on payment',    desc: 'Triggers automation workflows linked to the contact' },
              ].map(t => (
                <div key={t.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>{t.desc}</div>
                  </div>
                  <div onClick={() => set(t.key, !cfg[t.key])}
                    style={{ width: 44, height: 24, background: cfg[t.key] ? 'var(--blue)' : 'var(--dark3)', borderRadius: 12, position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .2s' }}>
                    <div style={{ position: 'absolute', top: 3, left: cfg[t.key] ? 23 : 3, width: 18, height: 18, background: 'white', borderRadius: '50%', transition: 'left .2s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Webhooks Tab */}
          {tab === 'webhooks' && (
            <div style={sec}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Webhook URLs</div>
              <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 24 }}>Add these in your GoPayFast merchant dashboard.</div>

              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>ITN (Instant Transaction Notification) URL</label>
                <div style={{ background: 'var(--dark3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <code style={{ fontSize: 13, color: 'var(--blue-light)', fontFamily: 'monospace' }}>
                    {appUrl}/api/payfast/itn
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${appUrl}/api/payfast/itn`)}
                    style={{ background: 'var(--dark)', border: '1px solid var(--border)', color: 'var(--gray)', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                    Copy
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 8 }}>
                  In GoPayFast dashboard, paste this as your callback/notification URL.
                </div>
              </div>

              <div style={{ background: 'rgba(0,82,255,0.06)', border: '1px solid rgba(0,82,255,0.15)', borderRadius: 10, padding: 16, fontSize: 13 }}>
                <strong>How it works:</strong>
                <ol style={{ marginTop: 8, paddingLeft: 18, color: 'var(--gray)', lineHeight: 1.8, fontSize: 12 }}>
                  <li>Customer completes payment on GoPayFast</li>
                  <li>GoPayFast sends POST to your ITN URL</li>
                  <li>Your app verifies the signature</li>
                  <li>Contact is tagged &amp; opportunity moved in your CRM</li>
                  <li>Payment is recorded in your dashboard</li>
                </ol>
              </div>
            </div>
          )}

          {/* Login Credentials Tab */}
          {tab === 'login' && (
            <div style={sec}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Your Login Credentials</div>
              <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 24 }}>
                Save these credentials. You will need them to access your dashboard.
              </div>

              {loginCreds ? (
                <div style={{ background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={lbl}>Username</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input style={inp({ flex: 1 })} value={loginCreds.username} readOnly />
                      <button 
                        onClick={() => navigator.clipboard.writeText(loginCreds.username)}
                        style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--dark)', color: 'var(--gray)', cursor: 'pointer', fontSize: 12 }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={lbl}>Password</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input style={inp({ flex: 1 })} type="text" value={loginCreds.password} readOnly />
                      <button 
                        onClick={() => navigator.clipboard.writeText(loginCreds.password)}
                        style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--dark)', color: 'var(--gray)', cursor: 'pointer', fontSize: 12 }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#22C55E' }}>
                    ✅ Credentials created successfully! You can now login at <a href="/login" style={{ color: '#3D7FFF' }}>/login</a>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#F87171' }}>
                  No login credentials found. Please reinstall the app or contact support.
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
