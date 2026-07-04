import { NextResponse } from 'next/server';
import { reactivateLocation } from '@/lib/billing';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await reactivateLocation(id);
  return NextResponse.json({ success: true });
}
