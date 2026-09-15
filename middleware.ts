import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

function secret() {
  const value = String(process.env.SESSION_SECRET || '');
  return value.length >= 32 ? new TextEncoder().encode(value) : null;
}

async function sessionFor(request: NextRequest) {
  const key = secret();
  const token = request.cookies.get('pf_session')?.value;
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    if ((payload.role !== 'user' && payload.role !== 'agency') || typeof payload.locationId !== 'string' || !payload.locationId) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/ghl/query') {
    if (request.headers.get('x-ghl-query-legacy') === '1') return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = '/api/ghl/query-v2';
    return NextResponse.rewrite(url);
  }

  const path = request.nextUrl.pathname;
  if (path.startsWith('/agency/login') || path.startsWith('/agency/install') || path.startsWith('/billing/suspended')) {
    return NextResponse.next();
  }

  const session = await sessionFor(request);
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = path.startsWith('/agency') ? '/agency/login' : '/login';
    url.searchParams.set('returnTo', `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  if (path.startsWith('/agency') && session.role !== 'agency') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/ghl/query', '/dashboard/:path*', '/settings/:path*', '/billing/:path*', '/agency/:path*'],
};
