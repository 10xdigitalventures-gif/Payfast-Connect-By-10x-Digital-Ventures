import { query } from './db';

export interface WalletBalance {
  balance: number;
  currency: string;
}

export async function getBalance(locationId: string): Promise<WalletBalance> {
  const rows = await query<any[]>(
    'SELECT balance, currency FROM wallets WHERE location_id = ?',
    [locationId]
  );

  return rows[0]
    ? { balance: Number(rows[0].balance || 0), currency: rows[0].currency || 'PKR' }
    : { balance: 0, currency: 'PKR' };
}

export async function addBalance(locationId: string, amount: number) {
  await query(
    `INSERT INTO wallets (location_id, balance) 
     VALUES (?, ?) 
     ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance), updated_at = CURRENT_TIMESTAMP`,
    [locationId, amount]
  );
  return await getBalance(locationId);
}

export async function subtractBalance(locationId: string, amount: number) {
  const current = await getBalance(locationId);
  if (current.balance < amount) {
    throw new Error('Insufficient wallet balance');
  }

  await query(
    'UPDATE wallets SET balance = balance - ? WHERE location_id = ?',
    [amount, locationId]
  );
  return await getBalance(locationId);
}

export async function clearBalance(locationId: string) {
  await query('UPDATE wallets SET balance = 0 WHERE location_id = ?', [locationId]);
}
