import { createDecipheriv, createHash } from 'node:crypto';

export type MarketplaceProvider = 'payfast' | 'whop' | 'swich';
export type MarketplaceUserContext = {
  userId: string;
  activeLocation: string;
  companyId?: string;
  role?: string;
  type?: string;
};

/**
 * HighLevel SSO uses CryptoJS.AES.encrypt(plaintext, passphrase).
 * Its default OpenSSL formatter encodes "Salted__" + 8-byte salt +
 * AES-256-CBC ciphertext; EVP_BytesToKey derives key/IV using MD5.
 * This is a compatibility decoder, NOT a general-purpose encryption API.
 */
export function decryptMarketplaceUserContext(encryptedData: string, sharedSecret: string): MarketplaceUserContext {
  if (!sharedSecret || sharedSecret.length < 16 ||
      typeof encryptedData !== 'string' || encryptedData.length > 16384 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encryptedData)) {
    throw new Error('Invalid marketplace user context');
  }
  const raw = Buffer.from(encryptedData, 'base64');
  if (raw.length < 32 || raw.subarray(0, 8).toString('ascii') !== 'Salted__' ||
      (raw.length - 16) % 16 !== 0) {
    throw new Error('Invalid marketplace user context');
  }
  const salt = raw.subarray(8, 16);
  const password = Buffer.from(sharedSecret, 'utf8');
  let material = Buffer.alloc(0);
  let previous = Buffer.alloc(0);
  while (material.length < 48) {
    previous = createHash('md5').update(Buffer.concat([previous, password, salt])).digest();
    material = Buffer.concat([material, previous]);
  }
  let decoded: any;
  try {
    const decipher = createDecipheriv('aes-256-cbc', material.subarray(0, 32), material.subarray(32, 48));
    const json = Buffer.concat([decipher.update(raw.subarray(16)), decipher.final()]).toString('utf8');
    decoded = JSON.parse(json);
  } catch {
    throw new Error('Invalid marketplace user context');
  }
  if (!decoded || typeof decoded !== 'object' ||
      typeof decoded.userId !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(decoded.userId) ||
      typeof decoded.activeLocation !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(decoded.activeLocation) ||
      (decoded.companyId !== undefined && typeof decoded.companyId !== 'string') ||
      (decoded.type !== undefined && !['agency', 'location'].includes(decoded.type))) {
    throw new Error('Invalid marketplace location context');
  }
  return {
    userId: decoded.userId,
    activeLocation: decoded.activeLocation,
    companyId: decoded.companyId,
    role: typeof decoded.role === 'string' ? decoded.role : undefined,
    type: typeof decoded.type === 'string' ? decoded.type : undefined,
  };
}

export function gatewaySharedSecret(provider: MarketplaceProvider): string {
  const envKey = {
    payfast: 'PAYFAST_GHL_SHARED_SECRET',
    whop: 'WHOP_GHL_SHARED_SECRET',
    swich: 'SWICH_GHL_SHARED_SECRET',
  }[provider];
  return String(process.env[envKey] || '');
}
