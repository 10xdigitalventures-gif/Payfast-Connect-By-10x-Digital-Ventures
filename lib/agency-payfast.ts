import { buildPaymentForm } from './payfast';
import { getAgencySettings } from './billing';

export async function buildAgencyBillingForm(params: {
  amount: string; itemName: string; itemDescription?: string; emailAddress: string; phone?: string; nameFirst?: string; nameLast?: string;
  locationId: string; invoiceToken: string; successRedirect?: string; callbackParams?: Record<string, string>;
}) {
  const settings = await getAgencySettings();
  const environment = settings?.environment === 'sandbox' ? 'sandbox' : 'live';
  const sandbox = environment === 'sandbox';
  const merchantId = sandbox ? settings?.sandbox_merchant_id : settings?.merchant_id;
  const merchantKey = sandbox ? settings?.sandbox_merchant_key : settings?.merchant_key;
  if (!merchantId || !merchantKey) throw new Error(`Agency PayFast ${environment} credentials are not configured`);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const callbackQuery = new URLSearchParams({ location_id: params.locationId, invoice_token: params.invoiceToken,
    ...Object.fromEntries(Object.entries(params.callbackParams || {}).filter(([, value]) => value != null)) }).toString();
  return buildPaymentForm({ merchantId, merchantKey,
    merchantName: (sandbox ? settings.sandbox_merchant_name : settings.merchant_name) || '10x Digital Ventures',
    storeId: (sandbox ? settings.sandbox_store_id : settings.store_id) || null,
    passphrase: sandbox ? settings.sandbox_passphrase : settings.passphrase, environment,
    amount: params.amount, itemName: params.itemName, itemDescription: params.itemDescription || '', emailAddress: params.emailAddress,
    phone: params.phone || '', nameFirst: params.nameFirst || '', nameLast: params.nameLast || '.',
    returnUrl: `${appUrl}/api/billing/itn?${callbackQuery}&redirect=Y`, cancelUrl: params.successRedirect || `${appUrl}/billing/plans?cancelled=1`,
    notifyUrl: `${appUrl}/api/billing/itn?${callbackQuery}`, mPaymentId: `BILL-${params.invoiceToken}`, currencyCode: 'PKR' });
}
