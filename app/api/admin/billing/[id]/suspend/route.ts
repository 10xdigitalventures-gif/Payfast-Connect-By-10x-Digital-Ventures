import { NextResponse } from 'next/server';
import { suspendLocation } from '@/lib/billing';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await suspendLocation(id);
  return NextResponse.json({ success: true });
}
