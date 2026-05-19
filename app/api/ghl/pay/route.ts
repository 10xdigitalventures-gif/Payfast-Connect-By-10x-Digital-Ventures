import { NextRequest, NextResponse } from 'next/server';
import { query, Installation } from '@/lib/db';
import { buildPaymentForm, buildSubscriptionForm } from '@/lib/payfast';
import { generateToken } from '@/lib/tokens';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    locationId,
    contactId,
    ghlTransactionId,
    invoiceId,
    orderId,
    amount,
    currency,
    description,
    nameFirst,
    nameLast,
    email,
    phone,
    isRecurring = false,
    frequency   = '3', // monthly
  } = body;

  if (!locationId || !amount || !email) {
    return NextResponse.json({ error: 'locationId, amount, email required' }, { status: 400 });
  }

  // Get GoPayFast credentials for this location
  const rows = await query<Installation[]>(
    'SELECT * FROM installations WHERE location_id = ?',
    [locationId]
  );

  if (!rows.length || !rows[0].merchant_id) {
    return NextResponse.json({
      error: 'GoPayFast not configured for this location. Go to Payments → Integrations → GoPayFast → Manage.',
    }, { status: 400 });
  }

  const inst = rows[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Store the ghlTransactionId so ITN can find it and notify CRM
  const payToken = generateToken(16);
  const basketId = `CRM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Save pending payment record
  await query(
    `INSERT INTO payments
      (location_id, contact_id, payer_email, payer_first, payer_last,
       amount, item_name, item_description, payment_type, status, pf_token, custom_str1, custom_str2, custom_str3)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      locationId, contactId || null, email,
      nameFirst || '', nameLast || '.',
      parseFloat(amount),
      description || 'CRM Payment',
      JSON.stringify({ invoiceId: invoiceId || null, orderId: orderId || null, contactId: contactId || null }),
      isRecurring ? 'subscription' : 'one-time',
      'pending',
      basketId,
      payToken,       // custom_str1 = our token
      locationId,     // custom_str2 = locationId
      ghlTransactionId, // custom_str3 = CRM transaction ID
    ]
  );

  const baseParams = {
    merchantId:   inst.merchant_id!,
    merchantKey:  inst.merchant_key!,
    merchantName: inst.merchant_name || null,
    storeId: inst.store_id || null,
    passphrase:   inst.passphrase,
    environment:  inst.environment,
    returnUrl:    `${appUrl}/api/payfast/itn?location_id=${encodeURIComponent(locationId)}&basket_id=${encodeURIComponent(basketId)}&redirect=Y`,
    cancelUrl:    `${appUrl}/api/payfast/itn?location_id=${encodeURIComponent(locationId)}&basket_id=${encodeURIComponent(basketId)}&redirect=Y`,
    notifyUrl:    `${appUrl}/api/payfast/itn?location_id=${encodeURIComponent(locationId)}&basket_id=${encodeURIComponent(basketId)}`,
    nameFirst:    nameFirst || '',
    nameLast:     nameLast  || '.',
    emailAddress: email,
    phone,
    amount:       parseFloat(amount).toFixed(2),
    itemName:     (description || 'CRM Payment').slice(0, 100),
    itemDescription: invoiceId ? `Invoice: ${invoiceId}` : orderId ? `Order: ${orderId}` : '',
    customStr1:   payToken,
    customStr2:   locationId,
    customStr3:   ghlTransactionId,
  };

  const form = isRecurring
    ? buildSubscriptionForm({ ...baseParams, frequency: frequency as '3' | '4' | '6', recurringAmount: baseParams.amount })
    : buildPaymentForm(baseParams);

  const resolvedForm = await form;

  return NextResponse.json({
    actionUrl: resolvedForm.actionUrl,
    fields: resolvedForm.fields,
    payToken,
  });
}
