'use client';

import { useEffect, type ReactNode } from 'react';

/**
 * HighLevel can nest or reload the custom-provider iframe while it transitions
 * between form steps. Keep announcing readiness in both payload formats used
 * by its checkout hosts so payment_initiate_props is delivered reliably.
 */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const ready = { type: 'custom_provider_ready', loaded: true, addCardOnFileSupported: true };

    const targets = () => {
      const result = new Set<Window>();
      try { if (window.parent && window.parent !== window) result.add(window.parent); } catch {}
      try { if (window.top && window.top !== window) result.add(window.top as Window); } catch {}
      try { if (window.parent?.parent && window.parent.parent !== window) result.add(window.parent.parent); } catch {}
      return result;
    };

    const announce = () => {
      if (stopped) return;
      for (const target of targets()) {
        try { target.postMessage(ready, '*'); } catch {}
        try { target.postMessage(JSON.stringify(ready), '*'); } catch {}
      }
    };

    announce();
    timer = setInterval(announce, 750);
    const onVisible = () => { if (document.visibilityState === 'visible') announce(); };
    window.addEventListener('focus', announce);
    window.addEventListener('pageshow', announce);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', announce);
      window.removeEventListener('pageshow', announce);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return children;
}
