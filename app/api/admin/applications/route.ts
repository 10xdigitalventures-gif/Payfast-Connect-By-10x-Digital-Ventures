import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  let sql = 'SELECT * FROM merchant_applications WHERE 1=1';
  const params: (string | number)[] = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND (full_name LIKE ? OR email LIKE ? OR business_name LIKE ? OR ghl_location_id LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = await query<any[]>(sql, params);
  return NextResponse.json(rows);
}
