import { NextRequest, NextResponse } from 'next/server';
import { query, Installation } from '@/lib/db';
import { getSession } from '@/lib/session';
import { buildPaymentForm, buildSubscriptionForm } from '@/lib/payfast';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { locationId } = session;

  // Get installation
  const rows = await query<Installation[]>(
    'SELECT * FROM installations WHERE location_id = ?',
    [locationId]
  );

  if (!rows.length) return NextResponse.json({ error: 'Not installed' }, { status: 404 });
  const inst = rows[0];

  if (!inst.merchant_id || !inst.merchant_key) {
    return NextResponse.json({ error: 'GoPayFast credentials not configured. Please go to Settings.' }, { status: 400 });
  }

  const body = await request.json();
  const {
    type = 'one-time',         // 'one-time' | 'subscription'
    amount,
    itemName,
    itemDescription,
    email,
    firstName,
    lastName,
    contactId,                 // CRM contact ID
    frequency  = '3',          // for subscriptions
    cycles     = '0',
  } = body;

  if (!amount || !itemName) {
    return NextResponse.json({ error: 'amount and itemName are required' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const basketId = `MAN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const baseParams = {
    merchantName:    inst.merchant_name || null,
    merchantId:      inst.merchant_id,
    merchantKey:     inst.merchant_key,
    storeId:         inst.store_id || null,
    passphrase:      inst.passphrase,
    environment:     inst.environment,
    returnUrl:       `${appUrl}/api/payfast/itn?location_id=${encodeURIComponent(locationId)}&basket_id=${encodeURIComponent(basketId)}&redirect=Y`,
    cancelUrl:       `${appUrl}/api/payfast/itn?location_id=${encodeURIComponent(locationId)}&basket_id=${encodeURIComponent(basketId)}&redirect=Y`,
    notifyUrl:       `${appUrl}/api/payfast/itn?location_id=${encodeURIComponent(locationId)}&basket_id=${encodeURIComponent(basketId)}`,
    nameFirst:       firstName || '',
    nameLast:        lastName  || '',
    emailAddress:    email     || '',
    amount:          parseFloat(amount).toFixed(2),
    itemName,
    itemDescription: itemDescription || '',
    customStr1:      contactId  || '',
    customStr2:      locationId,
    mPaymentId:      basketId,
  };

  let form;
  if (type === 'subscription') {
    form = buildSubscriptionForm({ ...baseParams, frequency, recurringAmount: baseParams.amount, cycles });
  } else {
    form = buildPaymentForm(baseParams);
  }

  const resolvedForm = await form;

  return NextResponse.json({
    actionUrl: resolvedForm.actionUrl,
    fields: resolvedForm.fields,
  });
}
