import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAgencyContext, getAgencyPlans } from '@/lib/ghl-saas';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.installMode !== 'agency') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ctx = await getAgencyContext(session.locationId);
    if (!ctx?.companyId || !ctx.accessToken) return NextResponse.json({ error: 'Agency context not ready' }, { status: 400 });

    const data = await getAgencyPlans(ctx.companyId, ctx.accessToken);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load agency plans' }, { status: 500 });
  }
}
