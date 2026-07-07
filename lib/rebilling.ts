import { query } from './db';
import { getAgencySettings } from './billing';
import { getMerchantAccessToken, performTokenizedTransaction } from './payfast';
import { convertPkrToUsd, resolveExchangeRate, chargeWhopPaymentMethod, billingPeriodDaysForFrequency } from './whop';

// Backup rebilling cron for agency SaaS subscriptions.
// GHL SaaS Configurator is the primary driver (off-session charge_payment);
// this cron catches any due subscription GHL missed. Routes each subscription
// to PayFast or Whop based on its stored provider.
export async function processRebilling() {
  const settings = await getAgencySettings();
  if (!settings) {
    throw new Error('Agency billing settings are not configured');
  }

  const now = new Date();

  // Find active subscriptions due for payment on either processor.
  const dueSubscriptions = await query<any[]>(
    `SELECT ls.*, ap.price_monthly
     FROM location_subscriptions ls
     JOIN agency_plans ap ON ls.plan_id = ap.id
     WHERE ls.status = 'active'
       AND ls.current_period_end <= ?
       AND (
         (COALESCE(ls.provider, 'payfast') = 'payfast' AND ls.recurring_token IS NOT NULL)
         OR (ls.provider = 'whop' AND ls.whop_payment_method_id IS NOT NULL)
       )`,
    [now]
  );

  const results = {
    processed: 0,
    failed: 0,
    errors: [] as any[],
  };

  const advancePeriod = async (locationId: string) => {
    const nextPeriodEnd = new Date();
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    await query(
      'UPDATE location_subscriptions SET current_period_end = ?, current_period_start = ? WHERE location_id = ?',
      [nextPeriodEnd, now, locationId]
    );
  };

  for (const sub of dueSubscriptions) {
    const provider = (sub.provider || 'payfast').toLowerCase();
    const amount = Number(sub.amount || sub.price_monthly || 0);
    try {
      if (provider === 'whop') {
        // ── Whop recurring charge (agency's own Whop account) ──
        if (!settings.whop_api_key || !settings.whop_company_id) {
          throw new Error('Agency Whop credentials are not configured');
        }
        if (!sub.whop_member_id || !sub.whop_payment_method_id) {
          throw new Error('Whop member/payment method missing for subscription');
        }

        const { rate } = await resolveExchangeRate(
          settings.whop_rate_mode,
          Number(settings.whop_exchange_rate || 280)
        );
        const usdAmount = convertPkrToUsd(amount, Number(settings.whop_fee_percent || 0), rate);

        const response = await chargeWhopPaymentMethod({
          apiKey: settings.whop_api_key,
          companyId: settings.whop_company_id,
          memberId: sub.whop_member_id,
          paymentMethodId: sub.whop_payment_method_id,
          usdAmount,
          planType: 'renewal',
          billingPeriodDays: billingPeriodDaysForFrequency('monthly'),
          metadata: { location_id: sub.location_id, source: 'agency_saas_rebilling' },
        });

        if (response.ok) {
          await advancePeriod(sub.location_id);
          results.processed++;
        } else {
          results.failed++;
          results.errors.push({ locationId: sub.location_id, provider, error: response.error });
        }
      } else {
        // ── PayFast recurring charge (agency merchant account) ──
        if (!settings.merchant_id || !settings.merchant_key) {
          throw new Error('Agency PayFast credentials are not configured');
        }

        const basketId = `REBILL-${sub.location_id}-${Date.now()}`;
        const accessToken = await getMerchantAccessToken({
          merchantId: settings.merchant_id,
          merchantKey: settings.merchant_key,
          amount: amount.toFixed(2),
          basketId,
        });

        const response = await performTokenizedTransaction({
          token: accessToken,
          instrumentToken: sub.recurring_token,
          transactionId: basketId,
          merchantUserId: settings.merchant_id,
          userMobileNumber: sub.payer_email || '00000000000',
          basketId,
          orderDate: now.toISOString().slice(0, 19).replace('T', ' '),
          description: `Monthly subscription for ${sub.location_id}`,
          amount: amount.toFixed(2),
          otp: 'RECURRING',
        });

        if (response.status_code === '00' || response.code === '00') {
          await advancePeriod(sub.location_id);
          results.processed++;
        } else {
          results.failed++;
          results.errors.push({ locationId: sub.location_id, provider, error: response.status_msg || response.message });
        }
      }
    } catch (e: any) {
      results.failed++;
      results.errors.push({ locationId: sub.location_id, provider, error: e.message });
    }
  }

  return results;
}
