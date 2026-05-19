import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');

  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 });

  const rows = await query<any[]>(
    `SELECT merchant_id, merchant_key, passphrase, environment
     FROM installations WHERE location_id = ?`,
    [locationId]
  );

  if (!rows.length) return NextResponse.json({});

  return NextResponse.json({
    merchant_id:  rows[0].merchant_id  || '',
    merchant_key: rows[0].merchant_key || '',
    passphrase:   rows[0].passphrase   || '',
    environment:  rows[0].environment  || 'live',
  });
}
