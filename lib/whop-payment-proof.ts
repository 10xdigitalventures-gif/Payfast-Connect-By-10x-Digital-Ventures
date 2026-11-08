/**
 * Signed Whop webhook payloads are not sufficient on their own to confirm an
 * existing GHL transaction: verify expected checkout amount/currency/plan.
 * Use Whop's gross customer total, never the net amount_after_fees.
 * Whop event schemas vary with pinned webhook API versions.
 */
export type WhopPaymentProof = { ok: true; chargeId: string; membershipId: string | null } |
  { ok: false; reason: 'unsupported_event' | 'invalid_payment' | 'amount_mismatch' | 'currency_mismatch' | 'plan_mismatch' | 'company_mismatch' };

function amountValue(value: unknown): number | null {
  const raw = value && typeof value === 'object' && 'amount' in value
    ? (value as {amount: unknown}).amount : value;
  if ((typeof raw !== 'number' && typeof raw !== 'string') || raw === '') return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function fieldId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : '';
  }
  return '';
}

export function verifyWhopPaymentEvent(
  event: any,
  expected: { usdAmount: number; currency: string; planId?: string | null; companyId?: string | null },
): WhopPaymentProof {
  // membership.renewed is not a charge confirmation; only a payment event is.
  if (event?.type !== 'payment.succeeded') return { ok: false, reason: 'unsupported_event' };
  const payment = event?.data;
  const id = fieldId(payment?.id);
  if (!id || !/^[A-Za-z0-9_-]{1,255}$/.test(id)) return { ok: false, reason: 'invalid_payment' };
  const total = amountValue(payment?.total ?? payment?.final_amount);
  if (total === null || !Number.isFinite(expected.usdAmount) || expected.usdAmount <= 0 ||
      Math.abs(total - expected.usdAmount) > 0.011) return { ok: false, reason: 'amount_mismatch' };
  if (String(payment?.currency || '').toUpperCase() !== expected.currency.toUpperCase()) {
    return { ok: false, reason: 'currency_mismatch' };
  }
  const receivedPlan = fieldId(payment?.plan_id || payment?.plan);
  if (expected.planId && receivedPlan !== expected.planId) return { ok: false, reason: 'plan_mismatch' };
  const receivedCompany = fieldId(payment?.company_id || payment?.company);
  if (expected.companyId && receivedCompany && receivedCompany !== expected.companyId) {
    return { ok: false, reason: 'company_mismatch' };
  }
  return { ok: true, chargeId: id, membershipId: fieldId(payment?.membership_id || payment?.membership) || null };
}
