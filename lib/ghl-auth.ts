import { NextRequest } from 'next/server';
import { query } from './db';
import { alertAdmin } from './alerts';
import crypto from 'crypto';

export function extractApiKey(request: NextRequest, body?: any): string | null {
  // 1) JSON body — what GHL actually sends
  const bodyKey =
    body?.apiKey ||
    body?.api_key ||
    body?.providerApiKey ||
    body?.provider_api_key ||
    null;
  if (bodyKey) return String(bodyKey);

  // 2) Header fallbacks
  const headerApiKey = request.headers.get('x-api-key');
  if (headerApiKey) return headerApiKey;

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('ApiKey ')) return authHeader.slice(7);
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);

  return null;
}

export async function validateProviderApiKey(
  locationId: string | undefined | null,
  request: NextRequest,
  eventType = 'unauthorized_query',
  body?: any
): Promise<boolean> {
  if (!locationId) return false;

  const apiKey = extractApiKey(request, body);
  const rows = await query<any[]>(
    `SELECT provider_api_key FROM installations WHERE location_id = ? LIMIT 1`,
    [locationId]
  );
  const expected = rows[0]?.provider_api_key || null;

  let ok = false;
  if (expected && apiKey && expected.length === apiKey.length) {
    try {
      const a = Buffer.from(String(expected));
      const b = Buffer.from(String(apiKey));
      ok = crypto.timingSafeEqual(a, b);
    } catch {
      ok = String(expected) === String(apiKey);
    }
  } else {
    ok = !!expected && expected === apiKey;
  }

  if (!ok) {
    try {
      await alertAdmin(eventType, {
        locationId,
        received: apiKey ? 'present' : 'missing',
        hasExpected: !!expected,
      });
    } catch {
      /* ignore */
    }
  }
  return !!ok;
}
