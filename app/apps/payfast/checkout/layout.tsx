import type { ReactNode } from 'react';
import CheckoutLayout from '../../../checkout/layout';

const payfastOnlyBridge = String.raw`
(() => {
  if (window.__payfastOnlyBridgeInstalled) return;
  window.__payfastOnlyBridgeInstalled = true;
  const previousFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    let url = typeof input === 'string' ? input : input && input.url ? input.url : '';
    if (url.includes('/api/checkout/providers')) {
      const parsed = new URL(url, window.location.origin);
      parsed.searchParams.set('app', 'payfast');
      url = parsed.pathname + parsed.search;
      input = typeof input === 'string' ? url : new Request(url, input);
    } else if (url.includes('/api/ghl/pay')) {
      url = url.replace('/api/ghl/pay', '/api/apps/payfast/pay');
      input = typeof input === 'string' ? url : new Request(url, input);
    }
    return previousFetch(input, init);
  };
})();
`;

declare global {
  interface Window { __payfastOnlyBridgeInstalled?: boolean; }
}

export default function PayfastCheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <CheckoutLayout>
      <script dangerouslySetInnerHTML={{ __html: payfastOnlyBridge }} />
      {children}
    </CheckoutLayout>
  );
}
