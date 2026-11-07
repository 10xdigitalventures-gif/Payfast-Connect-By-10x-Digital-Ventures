'use client';
import type { MarketplaceProvider } from './marketplace-sso';

/**
 * Request HighLevel encrypted user context for each settings operation.
 * Avoid third-party cookies: the backend issues a short-lived provider-scoped
 * bearer token only after decrypting HighLevel's app-specific SSO payload.
 */
export async function getGatewayMarketplaceToken(provider: MarketplaceProvider, locationId: string): Promise<string> {
  if (typeof window === 'undefined' || window.parent === window) {
    throw new Error('Open this integration inside HighLevel Payments → Integrations.');
  }
  const parent = window.parent;
  // Use referrer origin when present; supports HighLevel whitelabel domains.
  let parentOrigin = '*';
  try { if (document.referrer) parentOrigin = new URL(document.referrer).origin; }
  catch { /* The backend still verifies the encrypted context. */ }

  const encryptedData = await new Promise<string>((resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== parent) return;
      if (parentOrigin !== '*' && event.origin !== parentOrigin) return;
      const data = event.data;
      if (!data || data.message !== 'REQUEST_USER_DATA_RESPONSE') return;
      if (typeof data.payload !== 'string' || !data.payload) return;
      if (finished) return;
      finished = true;
      cleanup();
      resolve(data.payload);
    };
    const timer = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error('HighLevel user context not received. Open this page from the installed Marketplace app.'));
    }, 12000);
    window.addEventListener('message', onMessage);
    parent.postMessage({ message: 'REQUEST_USER_DATA' }, parentOrigin);
  });
  const res = await fetch('/api/marketplace/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, locationId, encryptedData }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.token !== 'string') {
    throw new Error(data?.error || 'Unable to verify your HighLevel session.');
  }
  return data.token;
}
