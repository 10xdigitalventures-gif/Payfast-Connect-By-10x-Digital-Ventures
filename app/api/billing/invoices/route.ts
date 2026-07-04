import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await query<any[]>(
    `SELECT bi.*, ap.name AS plan_name
     FROM billing_invoices bi
     LEFT JOIN agency_plans ap ON ap.id = bi.plan_id
     WHERE bi.location_id = ?
     ORDER BY bi.created_at DESC`,
    [session.locationId]
  );

  return NextResponse.json(rows);
}
