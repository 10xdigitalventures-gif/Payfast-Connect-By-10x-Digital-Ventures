/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // GHL embeds these pages in an iframe AND their HTML must never be
    // long-term cached: hashed JS chunks change on every deploy, so a stale
    // cached HTML document would reference a chunk hash that 404s (breaking
    // the payment iframe entirely). Force no-store on the HTML documents.
    const iframePageHeaders = [
      { key: 'X-Frame-Options', value: 'ALLOWALL' },
      { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
      { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
      { key: 'CDN-Cache-Control', value: 'no-store' },
    ];

    return [
      { source: '/payfast-config', headers: iframePageHeaders },
      { source: '/payfast-config/:path*', headers: iframePageHeaders },
      { source: '/checkout', headers: iframePageHeaders },
      { source: '/checkout/:path*', headers: iframePageHeaders },
    ];
  },
};

module.exports = nextConfig;
