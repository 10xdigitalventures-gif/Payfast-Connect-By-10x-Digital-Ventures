import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';
import { getAppUrl } from '@/lib/app-url';

export async function POST() {
  await clearSession();
  return NextResponse.redirect(
    getAppUrl('/install')
  );
}
