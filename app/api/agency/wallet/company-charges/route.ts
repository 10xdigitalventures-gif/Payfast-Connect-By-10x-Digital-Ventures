import { NextRequest, NextResponse } from 'next/server';
import { getAgencyContext } from '@/lib/ghl-saas';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';
import { parsePaginationParams, normalizeUpstreamResponse } from '@/lib/agency-proxy';

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 });

  const session = await getSession();
  if (!session || session.installMode !== 'agency') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inst = await query<any[]>('SELECT company_id FROM installations WHERE location_id = ? LIMIT 1', [session.locationId]);
  if (!inst.length) return NextResponse.json({ error: 'Agency installation not found' }, { status: 401 });
  const companyFromInst = inst[0]?.company_id;
  if (!companyFromInst) return NextResponse.json({ error: 'Agency not associated with a company' }, { status: 403 });
  if (String(companyFromInst) !== String(companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ctx = await getAgencyContext(session.locationId);
  if (!ctx || !ctx.accessToken) return NextResponse.json({ error: 'Unauthorized or missing agency token' }, { status: 401 });

  const { page, per_page } = parsePaginationParams(request.nextUrl.searchParams);
  const q = request.nextUrl.searchParams;
  const qs: Record<string, string> = {};
  for (const [k, v] of q.entries()) qs[k] = v;

  try {
    const url = `/warehouse/v2/usage-records/LocationChargesInCompanyWallet/${encodeURIComponent(qs['locationId'] || '')}?companyId=${encodeURIComponent(companyId)}${qs && Object.keys(qs).length ? `&${new URLSearchParams(qs).toString()}` : ''}`;
    const cacheKey = `GET:${url}`;
    const { getCache, setCache } = await import('@/lib/simple-cache');
    const cached = getCache(cacheKey);
    if (cached) return NextResponse.json(cached);

    const res = await fetch(`https://backend.leadconnectorhq.com${url}`, {
      headers: { Authorization: `Bearer ${ctx.accessToken}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) return NextResponse.json({ error: data?.message || text || 'Request failed' }, { status: res.status });
    const normalized = normalizeUpstreamResponse(data, page, per_page);
    setCache(cacheKey, normalized, 30);
    return NextResponse.json(normalized);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
