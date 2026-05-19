import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { addBalance, getBalance } from '@/lib/wallet';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const wallet = await getBalance(session.locationId);
  return NextResponse.json(wallet);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const amount = Number(body.amount || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'A valid amount is required' }, { status: 400 });
  }

  const wallet = await addBalance(session.locationId, amount);
  return NextResponse.json({ success: true, wallet });
}
