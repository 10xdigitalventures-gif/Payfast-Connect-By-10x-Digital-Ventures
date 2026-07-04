import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const rows = await query<any[]>(
    `SELECT * FROM agency_plans WHERE is_active = 1 ORDER BY price_monthly ASC, id ASC`
  );
  return NextResponse.json(rows);
}
