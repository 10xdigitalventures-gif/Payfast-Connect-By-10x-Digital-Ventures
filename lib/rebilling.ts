import { query } from './db';
import { getAgencySettings } from './billing';
import { getMerchantAccessToken, performTokenizedTransaction } from './payfast';

export async function processRebilling() {
  const settings = await getAgencySettings();
  if (!settings?.merchant_id || !settings?.merchant_key) {
    throw new Error('Agency billing credentials are not configured');
  }

  const now = new Date();
  
  // Find active subscriptions that are due for payment
  const dueSubscriptions = await query<any[]>(
    `SELECT ls.*, ap.price_monthly 
     FROM location_subscriptions ls
     JOIN agency_plans ap ON ls.plan_id = ap.id
     WHERE ls.status = 'active' 
     AND ls.current_period_end <= ? 
     AND ls.recurring_token IS NOT NULL`,
    [now]
  );

  const results = {
    processed: 0,
    failed: 0,
    errors: [] as any[],
  };

  for (const sub of dueSubscriptions) {
    try {
      const basketId = `REBILL-${sub.location_id}-${Date.now()}`;
      const accessToken = await getMerchantAccessToken({
        merchantId: settings.merchant_id,
        merchantKey: settings.merchant_key,
        amount: Number(sub.amount || sub.price_monthly || 0).toFixed(2),
        basketId,
      });

      // Use stored recurring_token to charge the customer
      const response = await performTokenizedTransaction({
        token: accessToken,
        instrumentToken: sub.recurring_token,
        transactionId: basketId,
        merchantUserId: settings.merchant_id,
        userMobileNumber: sub.payer_email || '00000000000',
        basketId,
        orderDate: now.toISOString().slice(0, 19).replace('T', ' '),
        description: `Monthly subscription for ${sub.location_id}`,
        amount: Number(sub.amount || sub.price_monthly || 0).toFixed(2),
        otp: 'RECURRING',
      });

      if (response.status_code === '00' || response.code === '00') {
        // Update subscription period
        const nextPeriodEnd = new Date();
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

        await query(
          'UPDATE location_subscriptions SET current_period_end = ?, current_period_start = ? WHERE location_id = ?',
          [nextPeriodEnd, now, sub.location_id]
        );
        
        results.processed++;
      } else {
        results.failed++;
        results.errors.push({ locationId: sub.location_id, error: response.status_msg || response.message });
      }
    } catch (e: any) {
      results.failed++;
      results.errors.push({ locationId: sub.location_id, error: e.message });
    }
  }

  return results;
}
