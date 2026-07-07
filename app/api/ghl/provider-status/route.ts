import { NextRequest, NextResponse } from 'next/server';
import { getValidToken } from '@/lib/ghl';

// Diagnostic: ask GHL itself whether our custom provider is CONNECTED
// and set as DEFAULT for a location, in live and test mode.
//
//   GET /api/ghl/provider-status?locationId=XATuRqXAuNpHyAST9U1b
//
// This calls the same GHL endpoints the checkout frontend relies on, so
// you can see the raw truth instead of guessing.

const GHL_API = 'https://services.leadconnectorhq.com';

async function callGhl(
  path: string,
  token: string,
  version: string,
  method: 'GET' | 'POST' = 'GET'
) {
  try {
    const res = await fetch(`${GHL_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Version: version,
        Accept: 'application/json',
      },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { path, status: res.status, ok: res.ok, data };
  } catch (error) {
    return {
      path,
      status: 0,
      ok: false,
      data: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json(
      { ok: false, error: 'Missing ?locationId=' },
      { status: 400 }
    );
  }

  const token = await getValidToken(locationId);
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        locationId,
        error: 'No valid GHL token for this location. App is not installed / OAuth not completed for this sub-account.',
      },
      { status: 200 }
    );
  }

  // 1) Fetch our custom-provider config (keys) that we POSTed at connect time.
  const config = await callGhl(
    `/payments/custom-provider/connect?locationId=${encodeURIComponent(locationId)}`,
    token,
    '2021-07-28'
  );

  // 2) List of providers GHL considers connected for this entity/location.
  //    This is what the checkout iframe host queries before dispatching props.
  const entityProviders = await callGhl(
    `/payments/integrations/provider/entity-providers?altId=${encodeURIComponent(locationId)}&altType=location`,
    token,
    '2021-07-28'
  );

  const summary = {
    hasConfig: config.ok && !!config.data,
    configStatus: config.status,
    entityProvidersStatus: entityProviders.status,
    hint:
      'If hasConfig is false OR entity-providers does not list this provider as connected+default in the mode your invoice uses (live vs test), GHL will load the /checkout iframe but never send payment_initiate_props. Fix in the sub-account: Payments -> Integrations -> connect this provider and Set as Default, in the SAME mode as the invoice.',
  };

  return NextResponse.json({
    ok: true,
    locationId,
    summary,
    config,
    entityProviders,
  });
}
