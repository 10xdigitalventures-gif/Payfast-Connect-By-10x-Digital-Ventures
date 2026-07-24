import { NextRequest, NextResponse } from 'next/server';
import { processRebilling } from '@/lib/rebilling';
import { enforceSuspensions } from '@/lib/suspension';

export async function POST(request: NextRequest) {
  try {
    const secret =
      request.headers.get('x-rebilling-secret') ||
      request.nextUrl.searchParams.get('secret') ||
      '';

    if (process.env.REBILLING_SECRET && secret !== process.env.REBILLING_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Attempt due charges (backstop to Whop's own recurring billing)
    const rebilling = await processRebilling();

    // 2. Enforce grace periods + suspend elapsed past_due sub-accounts
    let suspensions: any = null;
    try {
      suspensions = await enforceSuspensions();
    } catch (e: any) {
      suspensions = { error: e?.message || 'enforceSuspensions failed' };
    }

    return NextResponse.json({ rebilling, suspensions });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Rebilling failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
