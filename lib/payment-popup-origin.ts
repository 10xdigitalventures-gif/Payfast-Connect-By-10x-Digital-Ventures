/**
 * Browser-return popups are always opened by our own checkout iframe.
 * Pin postMessage to its configured application origin, never a URL/query
 * parameter supplied by a merchant, gateway, or callback caller.
 */
export function getPaymentPopupTargetOrigin(baseUrl = process.env.NEXT_PUBLIC_APP_URL): string | null {
  if (!baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    if (url.username || url.password) return null;
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    return url.origin;
  } catch {
    return null;
  }
}
