import type { ReactNode } from 'react';

const ghlStringBridge = String.raw`
(() => {
  if (window.__ghlStringBridgeInstalled) return;
  window.__ghlStringBridgeInstalled = true;

  const originalFetch = window.fetch.bind(window);
  let terminalSent = false;

  function postToAncestors(payload) {
    const message = JSON.stringify(payload);
    const targets = new Set();
    try { if (window.parent && window.parent !== window) targets.add(window.parent); } catch (_) {}
    try { if (window.top && window.top !== window) targets.add(window.top); } catch (_) {}
    try {
      if (window.parent && window.parent.parent && window.parent.parent !== window) {
        targets.add(window.parent.parent);
      }
    } catch (_) {}
    targets.forEach((target) => {
      try { target.postMessage(message, '*'); } catch (_) {}
    });
  }

  function sendTerminal(payload) {
    if (terminalSent) return;
    terminalSent = true;
    postToAncestors(payload);
  }

  window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    const input = args[0];
    const url = typeof input === 'string' ? input : input && input.url ? input.url : '';
    if (!url.includes('/api/ghl/payment-status')) return response;

    try {
      const data = await response.clone().json();
      if (data && data.status === 'paid') {
        sendTerminal({
          type: 'custom_element_success_response',
          chargeId: data.chargeId || ''
        });
      } else if (data && data.status === 'failed') {
        sendTerminal({
          type: 'custom_element_error_response',
          error: { description: 'Payment was declined or cancelled.' }
        });
      } else {
        return response;
      }

      // The checkout page currently posts terminal events as objects. Hide the
      // terminal status from that legacy path after this bridge sends the one
      // JSON-string event that HighLevel accepts.
      return new Response(JSON.stringify({ ...data, status: 'pending' }), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (_) {
      return response;
    }
  };

  window.addEventListener('click', (event) => {
    const target = event.target;
    const button = target && target.closest ? target.closest('button') : null;
    if (!button || button.textContent.trim() !== 'Cancel payment') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    sendTerminal({ type: 'custom_element_close_response' });
  }, true);
})();
`;

declare global {
  interface Window {
    __ghlStringBridgeInstalled?: boolean;
  }
}

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ghlStringBridge }} />
      {children}
    </>
  );
}
