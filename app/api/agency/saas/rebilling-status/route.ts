import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';

// Cron health endpoint: today invoice stats, recent failures, suspension count.
export async function GET() {
  const session = await getSession();
  if (!session || session.installMode !== 'agency') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [today, recentFailed, suspToday, totals, subs] = await Promise.all([
    query<any[]>(
      `SELECT
         COALESCE(SUM(status = 'paid'),    0) AS paid,
         COALESCE(SUM(status = 'failed'),  0) AS failed,
         COALESCE(SUM(status = 'pending'), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount,
         MAX(created_at) AS last_invoice_at
       FROM billing_invoices
       WHERE created_at >= ?`,
      [todayStart]
    ),
    query<any[]>(
      `SELECT bi.id, bi.location_id, bi.amount, bi.created_at, bi.status,
              ap.name AS plan_name,
              COALESCE(ma.business_name, i.merchant_name, bi.location_id) AS display_name
       FROM billing_invoices bi
       LEFT JOIN installations i        ON i.location_id        = bi.location_id
       LEFT JOIN merchant_applications ma ON ma.ghl_location_id = bi.location_id
       LEFT JOIN agency_plans ap        ON ap.id                = bi.plan_id
       WHERE bi.status = 'failed'
       ORDER BY bi.created_at DESC
       LIMIT 5`
    ),
    query<any[]>(
      `SELECT COALESCE(COUNT(*), 0) AS cnt FROM suspension_actions WHERE created_at >= ?`,
      [todayStart]
    ).catch(() => [{ cnt: 0 }]),
    query<any[]>(
      `SELECT
         COALESCE(SUM(status = 'paid'),    0) AS total_paid,
         COALESCE(SUM(status = 'failed'),  0) AS total_failed,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_revenue
       FROM billing_invoices`
    ),
    query<any[]>(
      `SELECT
         COALESCE(SUM(status = 'active'),   0) AS active,
         COALESCE(SUM(status = 'trial'),    0) AS trial,
         COALESCE(SUM(status = 'past_due'), 0) AS past_due,
         COALESCE(SUM(status = 'suspended'),0) AS suspended
       FROM location_subscriptions`
    ),
  ]);

  return NextResponse.json({
    today: today[0] || {},
    recentFailed,
    todaySuspensions: Number(suspToday[0]?.cnt || 0),
    totals: totals[0] || {},
    subscriptions: subs[0] || {},
  });
}
