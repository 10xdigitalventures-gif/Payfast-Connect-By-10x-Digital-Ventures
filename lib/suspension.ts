import { query } from './db';
import {
  getAgencyContext,
  pauseSaasLocation,
  updateSaasSubscription,
  bulkDisableSaas,
} from './ghl-saas';
import { alertAdmin } from './alerts';

// ─────────────────────────────────────────────────────────────
// Swappable suspension adapter (Architecture spec §10).
//
// GHL's dedicated pause/update-subscription endpoints are deprecated, so the
// underlying call is selected by env GHL_SUSPEND_STRATEGY and wrapped behind
// this interface. Business logic (grace periods, webhooks) only ever calls
// suspendClientLocation / resumeClientLocation and never touches endpoints.
// ─────────────────────────────────────────────────────────────

export type SuspendStrategy =
  | 'pause_saas'
  | 'update_subscription'
  | 'disable_saas'
  | 'local_only';

export function activeSuspendStrategy(): SuspendStrategy {
  const raw = (process.env.GHL_SUSPEND_STRATEGY || 'pause_saas').toLowerCase();
  if (raw === 'update_subscription' || raw === 'disable_saas' || raw === 'local_only') {
    return raw as SuspendStrategy;
  }
  return 'pause_saas';
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v).slice(0, 900);
  } catch {
    return String(v).slice(0, 900);
  }
}

async function logAction(entry: {
  locationId: string;
  companyId?: string | null;
  action: 'suspend' | 'resume' | 'cancel';
  strategy: string;
  reason?: string;
  ghlStatus: string;
  ghlResponse?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO suspension_actions
         (location_id, company_id, action, strategy, reason, ghl_status, ghl_response)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.locationId,
        entry.companyId || null,
        entry.action,
        entry.strategy,
        entry.reason || null,
        entry.ghlStatus,
        entry.ghlResponse || null,
      ]
    );
  } catch (e) {
    console.warn('[suspension] failed to log action', e);
  }
}

async function callGhl(
  action: 'suspend' | 'resume',
  locationId: string,
  companyId: string | null,
  accessToken: string | null,
  strategy: SuspendStrategy
): Promise<{ status: 'ok' | 'failed' | 'skipped'; response: string }> {
  if (strategy === 'local_only') {
    return { status: 'skipped', response: 'local_only strategy' };
  }
  if (!accessToken) {
    return { status: 'skipped', response: 'no agency access token' };
  }
  try {
    let res: unknown;
    if (strategy === 'pause_saas') {
      res = await pauseSaasLocation(locationId, accessToken, { paused: action === 'suspend' });
    } else if (strategy === 'disable_saas') {
      if (!companyId) return { status: 'skipped', response: 'no company id for disable_saas' };
      res = action === 'suspend'
        ? await bulkDisableSaas(companyId, accessToken, { locationIds: [locationId] })
        : { note: 'disable_saas has no resume; re-enable SaaS manually' };
    } else {
      res = await updateSaasSubscription(locationId, accessToken, {
        status: action === 'suspend' ? 'suspended' : 'active',
      });
    }
    return { status: 'ok', response: safeJson(res) };
  } catch (e: any) {
    return { status: 'failed', response: String(e?.message || e).slice(0, 900) };
  }
}

async function applyTransition(
  action: 'suspend' | 'resume',
  locationId: string,
  reason: string
) {
  const strategy = activeSuspendStrategy();
  const ctx = await getAgencyContext(locationId).catch(() => null);

  // Local state is the source of truth for access gating; update it first.
  if (action === 'resume') {
    await query(
      `UPDATE location_subscriptions SET status = 'active', grace_until = NULL WHERE location_id = ?`,
      [locationId]
    );
  } else {
    await query(
      `UPDATE location_subscriptions SET status = 'suspended' WHERE location_id = ?`,
      [locationId]
    );
  }

  const ghl = await callGhl(action, locationId, ctx?.companyId || null, ctx?.accessToken || null, strategy);

  await logAction({
    locationId,
    companyId: ctx?.companyId,
    action,
    strategy,
    reason,
    ghlStatus: ghl.status,
    ghlResponse: ghl.response,
  });

  if (ghl.status === 'failed') {
    await alertAdmin('ghl_suspension_failed', { locationId, action, strategy, error: ghl.response });
  }

  return { locationId, action, strategy, ghl };
}

export async function suspendClientLocation(locationId: string, reason = 'payment_failed') {
  return applyTransition('suspend', locationId, reason);
}

export async function resumeClientLocation(locationId: string, reason = 'payment_recovered') {
  return applyTransition('resume', locationId, reason);
}

// Grace-period enforcement (backstop cron). Model 1: Whop bills and webhooks
// drive most transitions; this catches anything missed.
//  1. active + period ended + no grace set  -> past_due, start grace window
//  2. past_due + grace elapsed              -> suspend via adapter
export async function enforceSuspensions() {
  const now = new Date();
  const summary = { markedPastDue: 0, suspended: 0, errors: [] as any[] };

  const settingsRows = await query<any[]>(
    'SELECT grace_period_days FROM agency_settings ORDER BY id ASC LIMIT 1'
  ).catch(() => []);
  const graceDays = Number(settingsRows?.[0]?.grace_period_days ?? 3);

  const overdue = await query<any[]>(
    `SELECT location_id FROM location_subscriptions
     WHERE status = 'active'
       AND current_period_end IS NOT NULL
       AND current_period_end < ?
       AND grace_until IS NULL`,
    [now]
  );
  for (const row of overdue) {
    const graceUntil = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
    await query(
      `UPDATE location_subscriptions SET status = 'past_due', grace_until = ? WHERE location_id = ?`,
      [graceUntil, row.location_id]
    );
    summary.markedPastDue++;
  }

  const expired = await query<any[]>(
    `SELECT location_id FROM location_subscriptions
     WHERE status = 'past_due'
       AND grace_until IS NOT NULL
       AND grace_until <= ?`,
    [now]
  );
  for (const row of expired) {
    try {
      await suspendClientLocation(row.location_id, 'grace_period_expired');
      summary.suspended++;
    } catch (e: any) {
      summary.errors.push({ locationId: row.location_id, error: e?.message || String(e) });
    }
  }

  return summary;
}
