import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';
import { getAppUrl } from '@/lib/app-url';

export async function POST() {
  const response = NextResponse.redirect(getAppUrl('/install'));
  await clearSession(response);
  return response;
}
