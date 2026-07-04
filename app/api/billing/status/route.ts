import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { checkSubscription, getLocationSubscription } from '@/lib/billing';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = await checkSubscription(session.locationId);
  const subscription = await getLocationSubscription(session.locationId);
  return NextResponse.json({ ...status, subscription });
}
