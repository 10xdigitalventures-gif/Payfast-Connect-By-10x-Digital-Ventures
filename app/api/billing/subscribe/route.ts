import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';
import { generateToken } from '@/lib/tokens';
import { getAgencySettings } from '@/lib/billing';
import { buildAgencyBillingForm } from '@/lib/agency-payfast';
import { buildSwichCheckoutForm } from '@/lib/swich';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const billingCycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const planId = Number(body.planId);
  const plans = await query<any[]>('SELECT * FROM agency_plans WHERE id = ? AND is_active = 1 LIMIT 1', [planId]);
  if (!plans.length) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  const plan = plans[0];
  const settings = await getAgencySettings();
  if (!settings) return NextResponse.json({ error: 'Agency billing is not configured' }, { status: 400 });
  const provider = String(body.provider || settings.route_subscription || 'payfast').toLowerCase();
  if (!['payfast', 'swich'].includes(provider)) return NextResponse.json({ error: `Provider ${provider} is not available for this checkout` }, { status: 400 });

  const installations = await query<any[]>('SELECT company_id FROM installations WHERE location_id = ? LIMIT 1', [session.locationId]);
  const invoiceToken = generateToken(16);
  const amount = billingCycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly);
  await query(`INSERT INTO billing_invoices (location_id, plan_id, amount, status, token, period_start, period_end, provider)
    VALUES (?, ?, ?, 'pending', ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 ${billingCycle === 'yearly' ? 'YEAR' : 'MONTH'}), ?)`,
    [session.locationId, planId, amount, invoiceToken, provider]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const callbackQuery = new URLSearchParams({ location_id: session.locationId, invoice_token: invoiceToken });
  if (provider === 'swich') {
    const environment = settings.environment === 'sandbox' ? 'sandbox' : 'live';
    const prefix = environment === 'sandbox' ? 'swich_sandbox' : 'swich_live';
    const clientId = settings[`${prefix}_client_id`];
    const secretKey = settings[`${prefix}_secret_key`];
    const checkoutUrl = settings[`${prefix}_checkout_url`];
    if (!clientId || !secretKey || !checkoutUrl) return NextResponse.json({ error: `Swich ${environment} credentials are not configured` }, { status: 400 });
    const form = buildSwichCheckoutForm({ clientId, secretKey, checkoutUrl, environment,
      customerTransactionId: invoiceToken, orderId: `BILL-${invoiceToken}`, amount: amount.toFixed(2), currency: 'PKR',
      returnUrl: `${appUrl}/api/swich/callback?${callbackQuery.toString()}&redirect=Y`,
      callbackUrl: `${appUrl}/api/swich/callback?${callbackQuery.toString()}`,
      customerEmail: body.email || '', customerMobile: body.phone || '', description: `${plan.name} ${billingCycle} subscription` });
    return NextResponse.json({ provider, environment, actionUrl: form.actionUrl, fields: form.fields, invoiceToken });
  }

  const environment = settings.environment === 'sandbox' ? 'sandbox' : 'live';
  const sandbox = environment === 'sandbox';
  const merchantId = sandbox ? settings.sandbox_merchant_id : settings.merchant_id;
  const merchantKey = sandbox ? settings.sandbox_merchant_key : settings.merchant_key;
  if (!merchantId || !merchantKey) return NextResponse.json({ error: `PayFast ${environment} credentials are not configured` }, { status: 400 });
  const original = { merchant_id: settings.merchant_id, merchant_key: settings.merchant_key, merchant_name: settings.merchant_name,
    store_id: settings.store_id, passphrase: settings.passphrase };
  Object.assign(settings, sandbox ? { merchant_id: settings.sandbox_merchant_id, merchant_key: settings.sandbox_merchant_key,
    merchant_name: settings.sandbox_merchant_name, store_id: settings.sandbox_store_id, passphrase: settings.sandbox_passphrase } : original);
  const form = await buildAgencyBillingForm({ amount: amount.toFixed(2), itemName: `${plan.name} Plan`,
    itemDescription: `${billingCycle} subscription for ${session.locationId}`, emailAddress: body.email || `${session.locationId}@crm.local`,
    phone: body.phone || '', nameFirst: body.nameFirst || installations[0]?.company_id || 'Client', nameLast: body.nameLast || '.',
    locationId: session.locationId, invoiceToken });
  return NextResponse.json({ provider, environment, actionUrl: form.actionUrl, fields: form.fields, invoiceToken });
}
