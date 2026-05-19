import { query } from './db';

export interface BillingStatus {
  exists: boolean;
  status: 'trial' | 'active' | 'suspended' | 'cancelled' | 'none';
  trialEndsAt: string | null;
  trialDaysLeft: number;
  currentPeriodEnd: string | null;
  needsPlanSelection: boolean;
  isSuspended: boolean;
}

export async function getAgencySettings() {
  const rows = await query<any[]>('SELECT * FROM agency_settings ORDER BY id ASC LIMIT 1');
  const legalRows = await query<any[]>('SELECT * FROM agency_legal_links ORDER BY id ASC LIMIT 1').catch(() => []);
  const settings = {
    ...(rows[0] || null),
    ...(legalRows[0] || null),
  };

  return Object.keys(settings).length ? settings : null;
}

export async function startTrial(locationId: string) {
  const settings = await getAgencySettings();
  const trialDays = Number(settings?.trial_days || 14);
  const trialEnds = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO location_subscriptions (location_id, status, trial_ends_at)
     VALUES (?, 'trial', ?)
     ON DUPLICATE KEY UPDATE
       status = IF(status = 'cancelled', status, status),
       trial_ends_at = COALESCE(trial_ends_at, VALUES(trial_ends_at))`,
    [locationId, trialEnds]
  );
}

export async function getLocationSubscription(locationId: string) {
  const rows = await query<any[]>(
    `SELECT ls.*, ap.name AS plan_name, ap.slug AS plan_slug, ap.price_monthly, ap.price_yearly, ap.features
     FROM location_subscriptions ls
     LEFT JOIN agency_plans ap ON ap.id = ls.plan_id
     WHERE ls.location_id = ?
     LIMIT 1`,
    [locationId]
  );

  return rows[0] || null;
}

export async function checkSubscription(locationId: string): Promise<BillingStatus> {
  const sub = await getLocationSubscription(locationId);
  if (!sub) {
    return {
      exists: false,
      status: 'none',
      trialEndsAt: null,
      trialDaysLeft: 0,
      currentPeriodEnd: null,
      needsPlanSelection: true,
      isSuspended: false,
    };
  }

  const now = Date.now();
  const trialEnds = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : null;
  const periodEnds = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const trialDaysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds - now) / (24 * 60 * 60 * 1000))) : 0;

  let status = sub.status as BillingStatus['status'];
  let needsPlanSelection = false;
  let isSuspended = false;

  if (status === 'trial' && trialEnds && trialEnds < now) {
    needsPlanSelection = true;
  }

  if (status === 'active' && periodEnds && periodEnds < now) {
    isSuspended = true;
    status = 'suspended';
  }

  if (status === 'suspended') {
    isSuspended = true;
  }

  return {
    exists: true,
    status,
    trialEndsAt: sub.trial_ends_at || null,
    trialDaysLeft,
    currentPeriodEnd: sub.current_period_end || null,
    needsPlanSelection,
    isSuspended,
  };
}

export async function suspendLocation(locationId: string) {
  await query(`UPDATE location_subscriptions SET status = 'suspended' WHERE location_id = ?`, [locationId]);
}

export async function reactivateLocation(locationId: string) {
  await query(`UPDATE location_subscriptions SET status = 'active' WHERE location_id = ?`, [locationId]);
}
