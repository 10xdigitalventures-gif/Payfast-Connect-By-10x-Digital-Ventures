import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.installMode !== 'agency') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const agency = await query<any[]>('SELECT company_id FROM installations WHERE location_id=? LIMIT 1', [session.locationId]);
    const companyId = agency[0]?.company_id;
    if (!companyId) return NextResponse.json({ error: 'Agency company is not configured' }, { status: 403 });
    const rows = await query<any[]>(`SELECT i.location_id,i.merchant_name,
      (SELECT ma.business_name FROM merchant_applications ma WHERE ma.ghl_location_id=i.location_id ORDER BY ma.id DESC LIMIT 1) AS business_name,
      (SELECT ma.status FROM merchant_applications ma WHERE ma.ghl_location_id=i.location_id ORDER BY ma.id DESC LIMIT 1) AS application_status
      FROM installations i WHERE i.company_id=? ORDER BY COALESCE((SELECT ma.business_name FROM merchant_applications ma WHERE ma.ghl_location_id=i.location_id ORDER BY ma.id DESC LIMIT 1),i.merchant_name,i.location_id)`, [companyId]);
    return NextResponse.json(rows.map((row) => ({ locationId: row.location_id, name: row.business_name || row.merchant_name || row.location_id,
      businessName: row.business_name || '', merchantName: row.merchant_name || '', status: row.application_status || '' })));
  } catch (error) { console.error('[agency/locations]', error); return NextResponse.json({ error: 'Unable to load agency locations' }, { status: 500 }); }
}
