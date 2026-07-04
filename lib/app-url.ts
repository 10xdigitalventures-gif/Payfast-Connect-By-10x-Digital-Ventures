import type { NextRequest } from 'next/server';

function normalizeOrigin(origin: string) {
  const url = new URL(origin);

  if (url.hostname === '0.0.0.0') {
    url.hostname = 'localhost';

    if (url.protocol === 'https:') {
      url.protocol = 'http:';
    }
  }

  return url;
}

export function getAppUrl(path: string, request?: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request?.nextUrl.origin || 'http://localhost:3000';
  const url = normalizeOrigin(baseUrl);
  url.pathname = path;
  url.search = '';
  return url;
}

export function getAppUrlWithSearch(pathWithSearch: string, request?: NextRequest) {
  return new URL(pathWithSearch, getAppUrl('/', request));
}
