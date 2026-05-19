import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Decrypt encryptedData received from GHL Custom Page parent window.
 *
 * Per official GHL docs (Authorization > User Context > Backend Implementation):
 * the encrypted payload is produced by `CryptoJS.AES.encrypt(plaintext, sharedSecretKey)`
 * on the GHL side, which uses OpenSSL's salted EVP_BytesToKey format. We replicate
 * the decryption in pure Node `crypto`.
 *
 * Returns:
 *   { userId, companyId, locationId, role, type, userName, email, isAgencyOwner }
 *
 *   For Location context, `locationId` is taken from `activeLocation`.
 *   For Agency  context, `locationId` will be null.
 */
function decryptCryptoJsAes(encryptedBase64: string, passphrase: string): string {
  const raw = Buffer.from(encryptedBase64, 'base64');

  // CryptoJS produces "Salted__" + 8 bytes salt + ciphertext
  if (raw.subarray(0, 8).toString('utf8') !== 'Salted__') {
    throw new Error('Invalid encrypted payload (missing Salted__ header)');
  }
  const salt       = raw.subarray(8, 16);
  const ciphertext = raw.subarray(16);

  // Derive 32-byte key + 16-byte IV using OpenSSL EVP_BytesToKey with MD5
  const derived = Buffer.alloc(48);
  let prev = Buffer.alloc(0);
  let written = 0;
  while (written < 48) {
    const h = crypto.createHash('md5');
    h.update(prev);
    h.update(Buffer.from(passphrase, 'utf8'));
    h.update(salt);
    prev = h.digest();
    prev.copy(derived, written);
    written += prev.length;
  }
  const key = derived.subarray(0, 32);
  const iv  = derived.subarray(32, 48);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return out.toString('utf8');
}

export async function POST(request: NextRequest) {
  try {
    const { encryptedData } = await request.json();
    if (!encryptedData || typeof encryptedData !== 'string') {
      return NextResponse.json({ error: 'encryptedData required' }, { status: 400 });
    }

    const secret = process.env.GHL_SHARED_SECRET || '';
    if (!secret) {
      return NextResponse.json({ error: 'GHL_SHARED_SECRET not configured' }, { status: 500 });
    }

    const plaintext = decryptCryptoJsAes(encryptedData, secret);

    let parsed: any;
    try {
      parsed = JSON.parse(plaintext);
    } catch {
      return NextResponse.json({
        error: 'Decrypted payload is not JSON',
        preview: plaintext.slice(0, 100),
      }, { status: 400 });
    }

    // Normalize: Location context has `activeLocation`; Agency context does not.
    return NextResponse.json({
      userId:        parsed.userId        || null,
      companyId:     parsed.companyId     || null,
      locationId:    parsed.activeLocation || parsed.locationId || null,
      role:          parsed.role          || null,
      type:          parsed.type          || null,
      userName:      parsed.userName      || null,
      email:         parsed.email         || null,
      isAgencyOwner: !!parsed.isAgencyOwner,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || 'Failed to decrypt user data',
    }, { status: 400 });
  }
}