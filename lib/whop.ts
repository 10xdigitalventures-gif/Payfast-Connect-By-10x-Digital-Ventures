import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Whop payment helper for the GoHighLevel custom-provider app.
//
// Ported from the "Whop Payments for WooCommerce" plugin
// (10x Digital Ventures). Whop charges in USD, so a PKR order total is
// converted to USD using a merchant-configured exchange rate + an optional
// percentage gateway fee, then a Whop hosted checkout is created.
//
// Confirmation happens asynchronously through a Standard-Webhooks signed
// webhook (see app/api/whop/webhook/route.ts), mirroring the PayFast ITN flow.
// ─────────────────────────────────────────────────────────────

export const WHOP_API_BASE = 'https://api.whop.com/api/v1';
export const WHOP_CHECKOUT_BASE = 'https://whop.com/checkout';

export interface WhopConfig {
  apiKey: string;
  companyId: string;
  exchangeRate: number; // how many PKR = 1 USD (e.g. 280)
  feePercent: number;   // percentage fee added on top of the order total
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Percentage fee expressed in PKR. Example: 1000 @ 10% = 100. */
export function calculateFeePkr(pkrTotal: number, feePercent: number): number {
  const percent = feePercent > 0 ? feePercent : 0;
  return round2(pkrTotal * (percent / 100));
}

/** (pkr_total + percentage_fee) / rate -> USD */
export function convertPkrToUsd(pkrTotal: number, feePercent: number, rate: number): number {
  const feePkr = calculateFeePkr(pkrTotal, feePercent);
  const r = rate > 0 ? rate : 280;
  return round2((pkrTotal + feePkr) / r);
}

/**
 * Fetches a live "PKR per 1 USD" rate from a free FX API. Returns null on any
 * failure so callers can safely fall back to the merchant's fixed rate.
 */
export async function fetchLivePkrPerUsd(): Promise<number | null> {
  const endpoints = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.exchangerate.host/latest?base=USD&symbols=PKR',
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data: any = await res.json();
      const rate = Number(data?.rates?.PKR);
      if (Number.isFinite(rate) && rate > 0) return round2(rate);
    } catch {
      /* try the next endpoint */
    }
  }
  return null;
}

/**
 * Resolves the PKR->USD rate to use for a charge.
 * - mode 'live': try the live FX rate, fall back to fixedRate on failure.
 * - otherwise:  use the merchant-configured fixedRate.
 */
export async function resolveExchangeRate(
  mode: string | null | undefined,
  fixedRate: number,
): Promise<{ rate: number; source: 'live' | 'fixed' }> {
  const fallback = fixedRate > 0 ? fixedRate : 280;
  if (mode === 'live') {
    const live = await fetchLivePkrPerUsd();
    if (live && live > 0) return { rate: live, source: 'live' };
  }
  return { rate: fallback, source: 'fixed' };
}

export interface CreateCheckoutParams {
  config: WhopConfig;
  usdAmount: number;
  metadata: Record<string, string>;
  /** 'one_time' (default) for normal checkout, 'renewal' for subscriptions. */
  planType?: 'one_time' | 'renewal';
  /** Billing interval in days for renewal plans (e.g. 30 = monthly). */
  billingPeriodDays?: number | null;
}

export interface WhopCheckoutResult {
  ok: boolean;
  planId?: string;
  checkoutId?: string;
  checkoutUrl?: string;
  status?: number;
  raw?: string;
  error?: string;
}

/**
 * Creates a Whop checkout configuration and returns the hosted checkout URL.
 * Matches the request shape used by the WooCommerce gateway: currency at the
 * top level, plan details (incl. company_id) nested under `plan`.
 */
export async function createWhopCheckout(params: CreateCheckoutParams): Promise<WhopCheckoutResult> {
  const { config, usdAmount, metadata } = params;
  const planType = params.planType === 'renewal' ? 'renewal' : 'one_time';

  // Inline plan for the checkout configuration. For subscriptions we send a
  // renewal plan with a billing_period (days) so Whop runs the recurring
  // billing and emits a payment.succeeded webhook every cycle.
  const plan: Record<string, unknown> = {
    initial_price: usdAmount, // dollars, e.g. 17.86
    plan_type: planType,
    company_id: config.companyId,
    currency: 'usd',
  };
  if (planType === 'renewal' && params.billingPeriodDays && params.billingPeriodDays > 0) {
    plan.billing_period = Math.round(params.billingPeriodDays);
  }

  try {
    const res = await fetch(`${WHOP_API_BASE}/checkout_configurations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'usd',
        plan,
        metadata,
      }),
    });

    const raw = await res.text();
    let body: any = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }

    // Plan id can appear in a couple of shapes depending on API version.
    let planId = '';
    if (body?.plan?.id) planId = body.plan.id;
    else if (body?.plan_id) planId = body.plan_id;

    if (res.ok && planId) {
      const checkoutId = body?.id || planId;
      return {
        ok: true,
        planId,
        checkoutId,
        checkoutUrl: `${WHOP_CHECKOUT_BASE}/${planId}`,
        status: res.status,
        raw,
      };
    }

    return {
      ok: false,
      status: res.status,
      raw,
      error: `Whop checkout could not be created (HTTP ${res.status}).`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface WhopSignatureInput {
  msgId: string | null;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  secret: string;
  toleranceSeconds?: number;
}

/**
 * Verifies a Whop webhook using the Standard Webhooks spec.
 * Signed content = "{id}.{timestamp}.{raw_body}"
 * Signature      = base64( HMAC_SHA256( key, signed_content ) )
 *
 * - "whsec_" prefixed secrets are base64-decoded (Standard Webhooks default).
 * - Otherwise the dashboard secret is used as raw UTF-8 bytes.
 * Returns true only when a signature matches (constant-time compare).
 */
export function verifyWhopSignature(input: WhopSignatureInput): boolean {
  const { msgId, timestamp, signature, rawBody, secret } = input;
  if (!secret) return false; // can't verify -> reject (fail closed)
  if (!msgId || !timestamp || !signature) return false;

  const tolerance = input.toleranceSeconds ?? 300;
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;

  // Replay protection: reject anything older/newer than the tolerance window.
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > tolerance) return false;

  const signedContent = `${msgId}.${timestamp}.${rawBody}`;
  const key = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice(6), 'base64')
    : Buffer.from(secret, 'utf8');

  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');

  // Header may contain space-separated "v1,<sig>" pairs.
  const signatures = signature.split(' ');
  for (const versioned of signatures) {
    const parts = versioned.split(',');
    const sig = parts.length === 2 ? parts[1] : parts[0];
    if (!sig) continue;
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(sig);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch {
      /* length mismatch — keep checking */
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
// Subscription / refund helpers (added for the GHL subscription + refund
// flows). All calls use the merchant's Whop API key as a Bearer token and
// target the documented REST endpoints under WHOP_API_BASE.
// ─────────────────────────────────────────────────────────────

export interface WhopApiResult<T = any> {
  ok: boolean;
  status?: number;
  data?: T;
  raw?: string;
  error?: string;
}

async function whopApiFetch(
  apiKey: string,
  path: string,
  init: { method: string; body?: unknown },
): Promise<WhopApiResult> {
  try {
    const res = await fetch(`${WHOP_API_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: init.body != null ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
    const raw = await res.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const message = data?.error?.message || `Whop API error (HTTP ${res.status}).`;
      return { ok: false, status: res.status, data, raw, error: message };
    }
    return { ok: true, status: res.status, data, raw };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Converts a GHL billing frequency into a Whop billing_period in days.
 * Whop renewal plans charge every `billing_period` days.
 */
export function billingPeriodDaysForFrequency(frequency?: string | null): number {
  const f = String(frequency || '').toLowerCase();
  if (f === 'daily' || f === 'day') return 1;
  if (f === 'weekly' || f === 'week') return 7;
  if (f === 'biweekly' || f === 'fortnightly') return 14;
  if (f === 'quarterly' || f === '4') return 90;
  if (f === 'semiannual' || f === 'biannual' || f === 'semi_annual') return 182;
  if (f === 'annual' || f === 'annually' || f === 'yearly' || f === '6') return 365;
  return 30; // monthly default
}

/**
 * Issues a full or partial refund for a Whop payment.
 * POST /payments/{id}/refund   (permission: payment:manage)
 * Omit partialAmount for a full refund.
 */
export async function refundWhopPayment(args: {
  apiKey: string;
  paymentId: string;
  partialAmount?: number | null;
}): Promise<WhopApiResult> {
  const { apiKey, paymentId, partialAmount } = args;
  if (!apiKey) return { ok: false, error: 'Missing Whop API key.' };
  if (!paymentId) return { ok: false, error: 'Missing Whop payment id.' };
  const body =
    partialAmount != null && partialAmount > 0 ? { partial_amount: partialAmount } : undefined;
  return whopApiFetch(apiKey, `/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST',
    body,
  });
}

/**
 * Cancels a Whop membership (subscription).
 * POST /memberships/{id}/cancel   (permission: membership:cancel)
 * Defaults to an immediate cancellation; pass atPeriodEnd=true to cancel at
 * the end of the current billing period.
 */
export async function cancelWhopMembership(args: {
  apiKey: string;
  membershipId: string;
  atPeriodEnd?: boolean;
}): Promise<WhopApiResult> {
  const { apiKey, membershipId, atPeriodEnd } = args;
  if (!apiKey) return { ok: false, error: 'Missing Whop API key.' };
  if (!membershipId) return { ok: false, error: 'Missing Whop membership id.' };
  return whopApiFetch(apiKey, `/memberships/${encodeURIComponent(membershipId)}/cancel`, {
    method: 'POST',
    body: { cancel_at_period_end: !!atPeriodEnd },
  });
}

/**
 * Charges an existing member off-session using a stored payment method.
 * POST /payments   (permission: payment:charge)
 * Responds immediately; the charge settles asynchronously and confirmation
 * arrives via the payment.succeeded / payment.failed webhooks.
 */
export async function chargeWhopPaymentMethod(args: {
  apiKey: string;
  companyId: string;
  memberId: string;
  paymentMethodId: string;
  usdAmount: number;
  planType?: 'one_time' | 'renewal';
  billingPeriodDays?: number | null;
  metadata?: Record<string, string>;
}): Promise<WhopApiResult> {
  const { apiKey, companyId, memberId, paymentMethodId, usdAmount } = args;
  if (!apiKey) return { ok: false, error: 'Missing Whop API key.' };
  if (!companyId || !memberId || !paymentMethodId) {
    return { ok: false, error: 'company_id, member_id and payment_method_id are required.' };
  }
  const planType = args.planType === 'renewal' ? 'renewal' : 'one_time';
  const plan: Record<string, unknown> = {
    initial_price: usdAmount,
    currency: 'usd',
    plan_type: planType,
  };
  if (planType === 'renewal' && args.billingPeriodDays && args.billingPeriodDays > 0) {
    plan.billing_period = Math.round(args.billingPeriodDays);
  }
  return whopApiFetch(apiKey, `/payments`, {
    method: 'POST',
    body: {
      company_id: companyId,
      member_id: memberId,
      payment_method_id: paymentMethodId,
      metadata: args.metadata || {},
      plan,
    },
  });
}
