import { buildPaymentForm } from './payfast';
import { getAgencySettings } from './billing';

export async function buildAgencyBillingForm(params: {
  amount: string;
  itemName: string;
  itemDescription?: string;
  emailAddress: string;
  phone?: string;
  nameFirst?: string;
  nameLast?: string;
  locationId: string;
  invoiceToken: string;
  successRedirect?: string;
  callbackParams?: Record<string, string>;
}) {
  const settings = await getAgencySettings();
  if (!settings?.merchant_id || !settings?.merchant_key) {
    throw new Error('Agency billing credentials are not configured');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const callbackQuery = new URLSearchParams({
    location_id: params.locationId,
    invoice_token: params.invoiceToken,
    ...Object.fromEntries(Object.entries(params.callbackParams || {}).filter(([, value]) => value != null)),
  }).toString();

  return buildPaymentForm({
    merchantId: settings.merchant_id,
    merchantKey: settings.merchant_key,
    merchantName: settings.merchant_name || '10x Digital Ventures',
    storeId: settings.store_id || null,
    passphrase: settings.passphrase,
    environment: settings.environment,
    amount: params.amount,
    itemName: params.itemName,
    itemDescription: params.itemDescription || '',
    emailAddress: params.emailAddress,
    phone: params.phone || '',
    nameFirst: params.nameFirst || '',
    nameLast: params.nameLast || '.',
    returnUrl: `${appUrl}/api/billing/itn?${callbackQuery}&redirect=Y`,
    cancelUrl: params.successRedirect || `${appUrl}/billing/plans?cancelled=1`,
    notifyUrl: `${appUrl}/api/billing/itn?${callbackQuery}`,
    mPaymentId: `BILL-${params.invoiceToken}`,
  });
}
