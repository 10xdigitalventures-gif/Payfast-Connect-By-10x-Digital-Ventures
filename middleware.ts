import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Existing HighLevel provider registrations may still point to /api/ghl/query.
  // Route them through the context-safe verifier without requiring every
  // location to reconnect immediately. Internal legacy forwarding opts out.
  if (request.headers.get('x-ghl-query-legacy') === '1') return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/api/ghl/query-v2';
  return NextResponse.rewrite(url);
}

export const config = { matcher: ['/api/ghl/query'] };
