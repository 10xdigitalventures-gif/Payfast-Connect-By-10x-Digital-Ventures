import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await query(
    `UPDATE location_subscriptions
     SET status = 'cancelled', cancel_at = NOW()
     WHERE location_id = ?`,
    [session.locationId]
  );

  return NextResponse.json({ success: true });
}
