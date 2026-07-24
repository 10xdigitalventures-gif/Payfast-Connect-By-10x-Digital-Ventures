import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { resumeClientLocation } from '@/lib/suspension';

// Manually resume a suspended or past-due client sub-account.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.installMode !== 'agency') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const locationId = String(body.locationId || '').trim();
  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }

  try {
    await resumeClientLocation(locationId, 'agency_manual_resume');
    return NextResponse.json({ ok: true, locationId });
  } catch (e) {
    console.error('[resume-location]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Resume failed' },
      { status: 500 }
    );
  }
}
