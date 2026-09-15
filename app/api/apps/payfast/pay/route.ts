import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { buildPaymentForm, buildSubscriptionForm, normalizeCurrencyCode } from '@/lib/payfast';
import { generateToken } from '@/lib/tokens';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { locationId, contactId, ghlTransactionId, invoiceId, orderId, subscriptionId, amount, currency,
    description, nameFirst, nameLast, email, phone, isRecurring = false, frequency = '3' } = body;
  if (!locationId || !amount || !email) return NextResponse.json({ error: 'locationId, amount, email required' }, { status: 400 });
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return NextResponse.json({ error: 'A valid positive amount is required' }, { status: 400 });
  let currencyCode: string;
  try { currencyCode = normalizeCurrencyCode(currency); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid currency' }, { status: 400 }); }

  const rows = await query<any[]>('SELECT * FROM payfast_ghl_installations WHERE location_id=? LIMIT 1', [locationId]);
  const installation = rows[0];
  if (!installation?.merchant_id || !installation?.merchant_key) {
    return NextResponse.json({ error: 'PayFast is not configured in the standalone PayFast app.' }, { status: 400 });
  }

  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const payToken = generateToken(16);
  const basketId = `CRM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await query(
    `INSERT INTO payments
      (location_id, contact_id, payer_email, payer_first, payer_last, amount, item_name, item_description,
       payment_type, provider, status, pf_token, custom_str1, custom_str2, custom_str3)
     VALUES (?,?,?,?,?,?,?,?,?,'payfast','pending',?,?,?,?)`,
    [locationId, contactId || null, email, nameFirst || '', nameLast || '.', numericAmount,
      description || 'CRM Payment', JSON.stringify({ invoiceId: invoiceId || null, orderId: orderId || null,
        contactId: contactId || null, subscriptionId: subscriptionId || null, currency: currencyCode }),
      isRecurring ? 'subscription' : 'one-time', basketId, payToken, locationId, ghlTransactionId || null],
  );

  const callback = `location_id=${encodeURIComponent(locationId)}&basket_id=${encodeURIComponent(basketId)}`;
  const params = {
    merchantId: installation.merchant_id,
    merchantKey: installation.merchant_key,
    merchantName: installation.merchant_name || null,
    storeId: installation.store_id || null,
    passphrase: installation.passphrase || null,
    environment: installation.environment,
    returnUrl: `${appUrl}/api/apps/payfast/itn?${callback}&redirect=Y`,
    cancelUrl: `${appUrl}/api/apps/payfast/itn?${callback}&redirect=Y&cancelled=Y`,
    notifyUrl: `${appUrl}/api/apps/payfast/itn?${callback}`,
    nameFirst: nameFirst || '', nameLast: nameLast || '.', emailAddress: email, phone,
    amount: numericAmount.toFixed(2), itemName: (description || 'CRM Payment').slice(0, 100),
    itemDescription: invoiceId ? `Invoice: ${invoiceId}` : orderId ? `Order: ${orderId}` : '',
    customStr1: payToken, customStr2: locationId, customStr3: ghlTransactionId || '',
    currencyCode, mPaymentId: basketId,
  };

  try {
    const form = await (isRecurring
      ? buildSubscriptionForm({ ...params, frequency: frequency as '3' | '4' | '6', recurringAmount: params.amount })
      : buildPaymentForm(params));
    return NextResponse.json({ actionUrl: form.actionUrl, fields: form.fields, payToken, basketId, currency: currencyCode });
  } catch (error) {
    await query(`UPDATE payments SET status='failed',updated_at=NOW() WHERE pf_token=? AND location_id=?`, [basketId, locationId]);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to start payment' }, { status: 400 });
  }
}
