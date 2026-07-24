import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { getAgencySettings } from "@/lib/billing";

// Plans are database-backed and tenant-specific; do not export this API route
// during the production build.
export const dynamic = "force-dynamic";

// Returns this agency's active plans from the local DB.
// Multi-tenant: returns rows scoped to whop_company_id first;
// falls back to global rows (company_id IS NULL) if none exist.
export async function GET() {
  const session = await getSession();
  if (!session || session.installMode !== "agency") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getAgencySettings();
  const companyId = settings?.whop_company_id || null;

  const plans = await query<any[]>(
    `SELECT id, name, slug, price_monthly, price_yearly, max_locations, features, trial_days
     FROM agency_plans
     WHERE is_active = 1
       AND (company_id = ? OR company_id IS NULL)
     ORDER BY price_monthly ASC`,
    [companyId],
  );

  return NextResponse.json({
    plans,
    defaultProvider: settings?.route_subscription || "payfast",
    whopEnabled: Boolean(settings?.whop_api_key && settings?.whop_company_id),
  });
}
