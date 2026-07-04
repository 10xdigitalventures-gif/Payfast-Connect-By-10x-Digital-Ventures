import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const rows = await query<any[]>(
    `SELECT ls.*, i.merchant_name,
            ap.name AS plan_name,
            bi_last.status AS last_invoice_status,
            bi_last.amount AS last_invoice_amount,
            bi_last.created_at AS last_invoice_at
      FROM location_subscriptions ls
      LEFT JOIN installations i ON i.location_id = ls.location_id
      LEFT JOIN agency_plans ap ON ap.id = ls.plan_id
      LEFT JOIN billing_invoices bi_last ON bi_last.id = (
        SELECT bi2.id FROM billing_invoices bi2 WHERE bi2.location_id = ls.location_id ORDER BY bi2.created_at DESC LIMIT 1
      )
     ORDER BY ls.updated_at DESC`
  );

  const stats = await query<any[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END),0) AS mrr,
       SUM(status = 'active') AS active_count,
       SUM(status = 'trial') AS trial_count,
       SUM(status = 'suspended') AS suspended_count,
       SUM(status = 'cancelled') AS cancelled_count
     FROM location_subscriptions`
  );

  return NextResponse.json({ rows, stats: stats[0] || null });
}
