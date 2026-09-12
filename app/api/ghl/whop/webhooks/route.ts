import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

function verifyWhopGhlSignature(payload: string, signature: string) {
  const configuredKey = (process.env.WHOP_GHL_WEBHOOK_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
  if (!configuredKey) return { ok: false, reason: 'WHOP_GHL_WEBHOOK_PUBLIC_KEY is not configured' };
  if (!signature || signature === 'N/A') return { ok: false, reason: 'signature is missing' };

  try {
    const ok = crypto.verify(
      null,
      Buffer.from(payload, 'utf8'),
      configuredKey,
      Buffer.from(signature, 'base64'),
    );
    return { ok, reason: ok ? null : 'signature verification failed' };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature =
    request.headers.get('x-wh-signature') ||
    request.headers.get('x-ghl-signature') ||
    '';

  const verification = verifyWhopGhlSignature(rawBody, signature);
  if (!verification.ok) {
    console.warn('[10x Whop GHL Webhook] rejected:', verification.reason);
    return NextResponse.json({ received: true, verified: false }, { status: 200 });
  }

  let body: any = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ received: true, verified: true, processed: false }, { status: 200 });
  }

  const type = String(body?.type || '');
  const locationId = String(body?.locationId || body?.data?.locationId || '');
  const companyId = body?.companyId || body?.data?.companyId || null;

  if (!locationId) {
    return NextResponse.json({ received: true, verified: true, processed: false }, { status: 200 });
  }

  if (type === 'AppInstall') {
    await query(
      `INSERT INTO whop_ghl_installations
        (location_id, company_id, access_token, refresh_token, expires_at, installed_at, updated_at)
       VALUES (?, ?, '', '', NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE company_id = VALUES(company_id), updated_at = NOW()`,
      [locationId, companyId],
    );
  } else if (type === 'AppUninstall') {
    await query('DELETE FROM whop_ghl_installations WHERE location_id = ?', [locationId]);
  }

  return NextResponse.json({ received: true, verified: true, processed: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: '10x Whop App',
    endpoint: 'GHL marketplace webhooks',
  });
}
