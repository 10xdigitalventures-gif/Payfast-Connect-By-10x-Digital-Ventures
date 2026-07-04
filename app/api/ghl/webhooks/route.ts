import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyGhlSignature } from '@/lib/ghl-webhooks';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-ghl-signature') || '';
    const rawBody = await request.text();
    
    // 1. Verify Signature
    const verification = verifyGhlSignature(rawBody, signature);
    if (!verification.ok) {
      console.error('[GHL Webhook] Invalid signature:', verification.reason);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { type, webhookId, data, locationId } = body;

    console.log('[GHL Webhook Received]', type, { webhookId, locationId });

    // 2. Idempotency check
    const alreadyProcessed = await query<any[]>(
      'SELECT id FROM processed_webhooks WHERE webhook_id = ? LIMIT 1',
      [webhookId]
    ).catch(() => []); // In case table doesn't exist yet

    if (alreadyProcessed.length) {
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
    }

    // 3. Handle Events
    switch (type) {
      case 'AppInstall':
        await query(
          `INSERT INTO installations (location_id, access_token, refresh_token, expires_at)
           VALUES (?, '', '', NOW())
           ON DUPLICATE KEY UPDATE updated_at = NOW()`,
          [locationId]
        );
        break;
      
      case 'AppUninstall':
        await query('DELETE FROM installations WHERE location_id = ?', [locationId]);
        break;

      case 'ContactCreate':
      case 'ContactUpdate':
        // Handle contact sync if needed
        break;

      default:
        console.log('[GHL Webhook] Unhandled event type:', type);
    }

    // 4. Mark as processed
    try {
      await query(
        `INSERT INTO processed_webhooks (webhook_id, event_type, processed_at)
         VALUES (?, ?, NOW())`,
        [webhookId, type]
      );
    } catch (e) {
      // If table doesn't exist, create it
      await query(`CREATE TABLE IF NOT EXISTS processed_webhooks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        webhook_id VARCHAR(255) UNIQUE,
        event_type VARCHAR(100),
        processed_at DATETIME
      )`);
      await query(
        `INSERT INTO processed_webhooks (webhook_id, event_type, processed_at)
         VALUES (?, ?, NOW())`,
        [webhookId, type]
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[GHL Webhook Error]', error);
    // Always return 200 to avoid GHL retries for internal errors unless it's a 429
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}
