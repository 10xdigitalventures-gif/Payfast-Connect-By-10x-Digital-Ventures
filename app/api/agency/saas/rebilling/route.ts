import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAgencyContext, updateRebilling } from '@/lib/ghl-saas';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.installMode !== 'agency') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const ctx = await getAgencyContext(session.locationId);
    if (!ctx?.companyId || !ctx.accessToken) return NextResponse.json({ error: 'Agency context not ready' }, { status: 400 });

    const data = await updateRebilling(ctx.companyId, ctx.accessToken, body);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update rebilling' }, { status: 500 });
  }
}
