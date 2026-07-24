import { NextRequest, NextResponse } from "next/server";
import { query, Installation } from "@/lib/db";
import { generateToken } from "@/lib/tokens";
import { createWhopSetupCheckout } from "@/lib/whop";

// Creates Whop's zero-charge setup checkout for HighLevel's "Add card on file" flow.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const locationId = String(body.locationId || "");
  const contactId = String(body.contactId || "");
  const email = String(body.email || "").trim();
  const name = String(body.name || "").trim();

  if (!locationId || !contactId || !email) {
    return NextResponse.json(
      { error: "locationId, contactId, and email are required to save a card" },
      { status: 400 },
    );
  }

  const rows = await query<Installation[]>(
    "SELECT * FROM installations WHERE location_id = ? LIMIT 1",
    [locationId],
  );
  const installation = rows[0];
  if (!installation?.whop_api_key || !installation.whop_company_id) {
    return NextResponse.json(
      { error: "Whop is not configured for this location." },
      { status: 400 },
    );
  }

  // payments is reused only as a secure, short-lived status record for the iframe poller.
  const setupId = `WHOP-SETUP-${generateToken(12)}`;
  await query(
    `INSERT INTO payments (location_id, contact_id, payer_email, payer_first, amount, item_name, payment_type, provider, status, pf_token, custom_str2)
     VALUES (?, ?, ?, ?, 0, 'Card on file setup', 'one-time', 'whop', 'pending', ?, ?)`,
    [locationId, contactId, email, name, setupId, locationId],
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const result = await createWhopSetupCheckout({
    config: {
      apiKey: installation.whop_api_key,
      companyId: installation.whop_company_id,
      exchangeRate: 1,
      feePercent: 0,
    },
    redirectUrl: `${appUrl}/checkout/success?location_id=${encodeURIComponent(locationId)}&basket_id=${encodeURIComponent(setupId)}&setup=1`,
    metadata: {
      kind: "ghl_payment_method_setup",
      setup_id: setupId,
      location_id: locationId,
      contact_id: contactId,
      customer_email: email,
    },
  });

  if (!result.ok || !result.checkoutUrl) {
    await query(
      `UPDATE payments SET status = 'failed', raw_itn = ? WHERE pf_token = ? AND location_id = ?`,
      [JSON.stringify(result), setupId, locationId],
    );
    return NextResponse.json(
      { error: result.error || "Could not start secure card setup." },
      { status: 502 },
    );
  }

  await query(
    `UPDATE payments SET whop_checkout_id = ? WHERE pf_token = ? AND location_id = ?`,
    [result.checkoutId || null, setupId, locationId],
  );
  return NextResponse.json({
    redirectUrl: result.checkoutUrl,
    basketId: setupId,
  });
}
