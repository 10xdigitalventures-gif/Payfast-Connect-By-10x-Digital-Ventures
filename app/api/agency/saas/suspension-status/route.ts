import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';

// Returns past-due / suspended locations and the latest suspension audit log.
export async function GET() {
  const session = await getSession();
  if (!session || session.installMode !== 'agency') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pastDue = await query<any[]>(
    `SELECT
       ls.location_id,
       ls.status,
       ls.grace_until,
       ls.last_payment_at,
       ls.current_period_end,
       ls.amount,
       ls.provider,
       ap.name                                                    AS plan_name,
       COALESCE(ma.business_name, i.merchant_name, ls.location_id) AS display_name
     FROM location_subscriptions ls
     LEFT JOIN installations i        ON i.location_id        = ls.location_id
     LEFT JOIN merchant_applications ma ON ma.ghl_location_id = ls.location_id
     LEFT JOIN agency_plans ap        ON ap.id                = ls.plan_id
     WHERE ls.status IN ('past_due', 'suspended')
     ORDER BY ls.updated_at DESC`
  ).catch(() => [] as any[]);

  const recentActions = await query<any[]>(
    `SELECT
       sa.id,
       sa.location_id,
       sa.action,
       sa.strategy,
       sa.reason,
       sa.ghl_status,
       sa.created_at,
       COALESCE(ma.business_name, i.merchant_name, sa.location_id) AS display_name
     FROM suspension_actions sa
     LEFT JOIN installations i        ON i.location_id        = sa.location_id
     LEFT JOIN merchant_applications ma ON ma.ghl_location_id = sa.location_id
     ORDER BY sa.created_at DESC
     LIMIT 50`
  ).catch(() => [] as any[]);

  return NextResponse.json({ pastDue, recentActions });
}
