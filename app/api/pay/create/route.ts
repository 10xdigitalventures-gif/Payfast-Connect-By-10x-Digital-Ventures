import { NextRequest, NextResponse } from 'next/server';
import { buildPaymentForm, buildSubscriptionForm } from '@/lib/payfast';
import { encodePublicPayMeta, resolvePublicPaySource } from '@/lib/public-pay';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token, name_first, name_last, email, phone, address, amount, is_recurring, interval, coupon_code } = body;

  if (!token || !email) {
    return NextResponse.json({ error: 'Token and email are required' }, { status: 400 });
  }

  const source = await resolvePublicPaySource(token);
  if (!source) return NextResponse.json({ error: 'Payment source not found' }, { status: 404 });

  const data = source.data;
  if (!data.merchant_id || !data.merchant_key) {
    return NextResponse.json({ error: 'GoPayFast is not configured for this payment' }, { status: 400 });
  }

  if (source.kind === 'payment_link') {
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This payment link has expired' }, { status: 400 });
    }
    if (data.max_uses > 0 && data.uses_count >= data.max_uses) {
      return NextResponse.json({ error: 'This payment link has reached its usage limit' }, { status: 400 });
    }
  }

  if (source.kind === 'schedule_installment' && data.status === 'overdue') {
    // Allow overdue installments to remain payable.
  }

  let finalAmount = parseFloat(amount || data.amount || data.total || '0');
  let couponCode: string | null = null;

  if (coupon_code && (data.allow_coupon === 1 || data.allow_coupon === true)) {
    const coupons = await query<any[]>(
      `SELECT * FROM coupons WHERE location_id = ? AND code = ? AND is_active = 1 LIMIT 1`,
      [data.location_id, String(coupon_code).trim().toUpperCase()]
    );
    const coupon = coupons[0];

    if (coupon) {
      const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
      const maxed = coupon.max_uses > 0 && coupon.uses_count >= coupon.max_uses;
      const meetsMin = finalAmount >= Number(coupon.min_amount || 0);

      if (!expired && !maxed && meetsMin) {
        const discount = coupon.type === 'percent'
          ? (finalAmount * Number(coupon.value)) / 100
          : Number(coupon.value);
        finalAmount = Math.max(0, finalAmount - discount);
        couponCode = coupon.code;
      }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const successRedirect = data.success_redirect || `${appUrl}/pay/success`;
  const basketId = `PUB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const paymentMeta = {
    kind: source.kind,
    id: data.id,
    couponCode,
    successRedirect,
    cancelRedirect: `${appUrl}/pay/${token}`,
  };

  await query(
    `INSERT INTO payments
      (location_id, pf_token, contact_id, payer_email, payer_first, payer_last, amount, item_name, item_description, payment_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE payer_email = VALUES(payer_email), amount = VALUES(amount), item_description = VALUES(item_description), updated_at = NOW()`,
    [
      data.location_id,
      basketId,
      data.contact_id || null,
      email,
      name_first || '',
      name_last || '.',
      finalAmount,
      (data.name || data.title || data.description || 'Payment Request').slice(0, 100),
      JSON.stringify(paymentMeta),
      is_recurring || data.type === 'subscription' ? 'subscription' : 'one-time',
      'pending',
    ]
  );

  const baseParams = {
    merchantId: data.merchant_id,
    merchantKey: data.merchant_key,
    merchantName: data.merchant_name || null,
    storeId: data.store_id || null,
    passphrase: data.passphrase,
    environment: data.environment,
    returnUrl: `${appUrl}/api/payfast/itn?location_id=${encodeURIComponent(data.location_id)}&basket_id=${encodeURIComponent(basketId)}&redirect=Y`,
    cancelUrl: `${appUrl}/api/payfast/itn?location_id=${encodeURIComponent(data.location_id)}&basket_id=${encodeURIComponent(basketId)}&redirect=Y`,
    notifyUrl: `${appUrl}/api/payfast/itn?location_id=${encodeURIComponent(data.location_id)}&basket_id=${encodeURIComponent(basketId)}`,
    nameFirst: name_first || '',
    nameLast: name_last || '.',
    emailAddress: email,
    phone,
    amount: finalAmount.toFixed(2),
    itemName: (data.name || data.title || data.description || 'Payment Request').slice(0, 100),
    itemDescription: (data.description || data.notes || '').slice(0, 255),
    customStr1: data.contact_id || '',
    customStr2: data.location_id,
    customStr4: encodePublicPayMeta({ kind: source.kind, id: data.id, couponCode }),
    mPaymentId: basketId,
  };

  const frequencyMap: Record<string, '3' | '4' | '6'> = {
    monthly: '3',
    quarterly: '4',
    annual: '6',
  };

  if (source.kind === 'text2pay' && data.status === 'sent') {
    await query('UPDATE text2pay SET status = ? WHERE id = ? AND status = ?', ['viewed', data.id, 'sent']);
  }

  const form = is_recurring || data.type === 'subscription'
    ? buildSubscriptionForm({
        ...baseParams,
        frequency: frequencyMap[interval || data.interval || 'monthly'] || '3',
        recurringAmount: baseParams.amount,
      })
    : buildPaymentForm(baseParams);

  const resolvedForm = await form;

  return NextResponse.json({ actionUrl: resolvedForm.actionUrl, fields: resolvedForm.fields });
}
