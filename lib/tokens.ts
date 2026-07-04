import crypto from 'crypto';

export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateInvoiceNumber(locationId: string): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${y}${m}-${rand}`;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) + '-' + Math.random().toString(36).slice(2, 6);
}
