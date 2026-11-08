import { verifyWhopPaymentEvent } from '../lib/whop-payment-proof';
const expected = { usdAmount: 14.25, currency: 'USD', planId: 'plan-A', companyId: 'biz-A' };
const payload = (overrides: Record<string, unknown> = {}, type = 'payment.succeeded') => ({
  type,
  data: { id: 'pay-A', total: 14.25, currency: 'usd', plan_id: 'plan-A', company_id: 'biz-A', membership_id: 'mber-A', ...overrides },
});
describe('Whop signed event payment reconciliation', () => {
  it('accepts a charge matching gross amount, currency, plan, and company', () => {
    expect(verifyWhopPaymentEvent(payload(), expected)).toEqual({ok:true,chargeId:'pay-A',membershipId:'mber-A'});
    expect(verifyWhopPaymentEvent(payload({ total: { amount: '14.25' } }), expected).ok).toBe(true);
    expect(verifyWhopPaymentEvent(payload({total: undefined, final_amount:14.25}), expected).ok).toBe(true);
  });
  it('does not complete payment on membership-only events', () => {
    expect(verifyWhopPaymentEvent(payload({}, 'membership.renewed'),expected)).toEqual({ok:false,reason:'unsupported_event'});
  });
  it.each([
    [{total:1}, 'amount_mismatch'],
    [{total:undefined,final_amount:undefined}, 'amount_mismatch'],
    [{currency:'PKR'},'currency_mismatch'],
    [{plan_id:'plan-other'},'plan_mismatch'],
    [{plan_id:undefined},'plan_mismatch'],
    [{company_id:'biz-other'},'company_mismatch'],
    [{id:''},'invalid_payment'],
  ])('rejects mismatched payment field %j', (fields,reason) => {
    expect(verifyWhopPaymentEvent(payload(fields), expected)).toEqual({ok:false,reason});
  });
  it('rejects stored metadata without a valid expected USD amount', () => {
    expect(verifyWhopPaymentEvent(payload(), {...expected,usdAmount:NaN})).toEqual({ok:false,reason:'amount_mismatch'});
  });
});
