import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { removePaymentInstrument, setDefaultPaymentInstrument } from '@/lib/payment-instruments';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const instrumentId = Number(id);
  if (!Number.isFinite(instrumentId) || instrumentId <= 0) {
    return NextResponse.json({ error: 'Invalid payment method id' }, { status: 400 });
  }

  await removePaymentInstrument(session.locationId, instrumentId);
  return NextResponse.json({ success: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const instrumentId = Number(id);
  if (!Number.isFinite(instrumentId) || instrumentId <= 0) {
    return NextResponse.json({ error: 'Invalid payment method id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.action !== 'set-default') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  await setDefaultPaymentInstrument(session.locationId, instrumentId);
  return NextResponse.json({ success: true });
}
