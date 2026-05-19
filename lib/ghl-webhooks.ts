import crypto from 'crypto';

const GHL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=-----END PUBLIC KEY-----`;

export function verifyGhlSignature(payload: string, signature: string) {
  if (!signature || signature === 'N/A') return { ok: false, reason: 'no signature' };
  try {
    const payloadBuffer = Buffer.from(payload, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'base64');
    const ok = crypto.verify(null, payloadBuffer, GHL_PUBLIC_KEY, signatureBuffer);
    return { ok, reason: ok ? null : 'verify failed' };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
