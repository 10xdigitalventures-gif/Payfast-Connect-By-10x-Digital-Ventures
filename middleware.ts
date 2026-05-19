import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getAppUrl } from '@/lib/app-url';

const secret = () => {
  const s = process.env.SESSION_SECRET || 'default_secret_fallback_32_chars_min';
  return new TextEncoder().encode(s);
};

const PROTECTED = [
  '/dashboard',
  '/billing',
  '/settings',
  '/agency/settings',
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const searchParams = request.nextUrl.searchParams;

  // Bypass mode for testing - no session required
  if (searchParams.get('preview') === 'true' || searchParams.get('demo') === 'true') {
    return NextResponse.next();
  }

  if (path.startsWith('/admin') && path !== '/admin/login') {
    const adminCookie = request.cookies.get('pf_admin')?.value;
    const expectedAdmin = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';

    if (adminCookie !== expectedAdmin) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  if (PROTECTED.some(p => path.startsWith(p))) {
    const token = request.cookies.get('pf_session')?.value;

    if (!token) {
      if (path.startsWith('/agency')) {
        return NextResponse.redirect(new URL('/agency/login', request.url));
      }
      return NextResponse.redirect(getAppUrl('/login', request));
    }

    try {
      const { payload } = await jwtVerify(token, secret());
      const role = (payload.role as string) || 'user';
      const installMode = (payload.installMode as string) || 'subaccount';

      // 1. Agency users MUST go to /agency
      if (role === 'agency' && !path.startsWith('/agency')) {
        return NextResponse.redirect(new URL('/agency', request.url));
      }

      // 2. Regular users MUST NOT enter /agency
      if (role === 'user' && path.startsWith('/agency')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      // 3. Handle OAuth install mode for legacy sessions
      if (installMode === 'agency' && !path.startsWith('/agency') && path === '/install') {
        return NextResponse.redirect(new URL('/agency', request.url));
      }
      if (installMode === 'subaccount' && path.startsWith('/agency')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(getAppUrl('/login', request));
      response.cookies.delete('pf_session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/agency/:path*',
    '/admin/:path*',
    '/billing/:path*',
    '/settings/:path*',
    '/agency/settings/:path*',
    '/docs/:path*',
    '/support/:path*',
  ],
};
