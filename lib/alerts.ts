export async function alertAdmin(event: string, details: Record<string, unknown> = {}) {
  try {
    const webhook = process.env.ALERT_WEBHOOK;
    if (!webhook) return;
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, details, ts: Date.now() }),
    });
  } catch (err) {
    // best-effort; do not throw
    console.warn('[alertAdmin] failed to call webhook', err);
  }
}
