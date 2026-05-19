import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAgencyContext, pauseSaasLocation } from '@/lib/ghl-saas';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.installMode !== 'agency') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 });

    const ctx = await getAgencyContext(session.locationId);
    if (!ctx?.accessToken) return NextResponse.json({ error: 'Agency token unavailable' }, { status: 400 });

    const data = await pauseSaasLocation(body.locationId, ctx.accessToken, body.payload || {});
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to pause location' }, { status: 500 });
  }
}
