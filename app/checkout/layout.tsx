'use client';

import { useEffect, type ReactNode } from 'react';

/**
 * HighLevel can nest or reload the custom-provider iframe while it transitions
 * between form steps. This bridge keeps the readiness handshake alive and also
 * forwards the verified popup result directly to HighLevel so its receipt /
 * post-submit step cannot remain stuck on our waiting screen.
 */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    let stopped = false;
    let terminalSent = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const ready = { type: 'custom_provider_ready', loaded: true, addCardOnFileSupported: true };

    const targets = () => {
      const result = new Set<Window>();
      try { if (window.parent && window.parent !== window) result.add(window.parent); } catch {}
      try { if (window.top && window.top !== window) result.add(window.top as Window); } catch {}
      try { if (window.parent?.parent && window.parent.parent !== window) result.add(window.parent.parent); } catch {}
      return result;
    };

    const broadcast = (payload: Record<string, unknown>) => {
      for (const target of targets()) {
        try { target.postMessage(payload, '*'); } catch {}
        try { target.postMessage(JSON.stringify(payload), '*'); } catch {}
      }
    };

    const announce = () => { if (!stopped && !terminalSent) broadcast(ready); };

    const onMessage = async (event: MessageEvent) => {
      if (terminalSent || event.origin !== window.location.origin) return;
      let data: any = event.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
      if (!data || data.type !== 'payfast_popup_result') return;

      if (data.status === 'cancelled') {
        terminalSent = true;
        broadcast({ type: 'custom_element_close_response' });
        return;
      }
      if (data.status === 'failed') {
        terminalSent = true;
        broadcast({ type: 'custom_element_error_response', error: { description: 'Payment was declined or cancelled.' } });
        return;
      }
      if (data.status !== 'complete') return;

      // The popup and checkout iframe share our origin after PayFast redirects
      // back, so read its callback context and ask our backend for the verified
      // provider charge ID before telling HighLevel to open the receipt step.
      try {
        const source = event.source as Window | null;
        const popupUrl = source ? new URL(source.location.href) : null;
        const basketId = popupUrl?.searchParams.get('basket_id') || '';
        const locationId = popupUrl?.searchParams.get('location_id') || '';
        if (!basketId || !locationId) return;
        const qs = new URLSearchParams({ basketId, locationId });
        const response = await fetch(`/api/ghl/payment-status?${qs.toString()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) return;
        const payment = await response.json();
        if (payment.status !== 'paid') return;
        terminalSent = true;
        if (timer) clearInterval(timer);
        broadcast({ type: 'custom_element_success_response', chargeId: payment.chargeId || basketId });
      } catch (error) {
        console.error('[checkout bridge] unable to forward popup completion', error);
      }
    };

    announce();
    timer = setInterval(announce, 750);
    const onVisible = () => { if (document.visibilityState === 'visible') announce(); };
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', announce);
    window.addEventListener('pageshow', announce);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', announce);
      window.removeEventListener('pageshow', announce);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return children;
}
