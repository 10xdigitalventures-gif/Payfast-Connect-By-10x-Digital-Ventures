import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { code, amount, location_id } = body;

  if (!code || !location_id) {
    return NextResponse.json({ valid: false, message: 'Coupon code required' }, { status: 400 });
  }

  const rows = await query<any[]>(
    `SELECT * FROM coupons WHERE location_id = ? AND code = ? AND is_active = 1 LIMIT 1`,
    [location_id, String(code).trim().toUpperCase()]
  );

  const coupon = rows[0];
  if (!coupon) return NextResponse.json({ valid: false, message: 'Invalid coupon code' });

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, message: 'Coupon has expired' });
  }

  if (coupon.max_uses > 0 && coupon.uses_count >= coupon.max_uses) {
    return NextResponse.json({ valid: false, message: 'Coupon usage limit reached' });
  }

  const orderAmount = parseFloat(amount || '0');
  if (orderAmount < Number(coupon.min_amount || 0)) {
    return NextResponse.json({ valid: false, message: `Minimum order is PKR ${Number(coupon.min_amount).toLocaleString()}` });
  }

  const discount = coupon.type === 'percent'
    ? (orderAmount * Number(coupon.value)) / 100
    : Number(coupon.value);

  return NextResponse.json({
    valid: true,
    discount_amount: Math.min(orderAmount, discount),
    message: coupon.type === 'percent' ? `${coupon.value}% discount applied` : `PKR ${coupon.value} discount applied`,
  });
}
