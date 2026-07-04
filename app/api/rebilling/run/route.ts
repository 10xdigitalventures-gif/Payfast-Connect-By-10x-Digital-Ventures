import { NextRequest, NextResponse } from 'next/server';
import { processRebilling } from '@/lib/rebilling';

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-rebilling-secret') || request.nextUrl.searchParams.get('secret') || '';

    if (process.env.REBILLING_SECRET && secret !== process.env.REBILLING_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processRebilling();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Rebilling failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
