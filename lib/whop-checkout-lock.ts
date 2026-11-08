import { createHash } from 'node:crypto';
import { getPool } from './db';

/**
 * Prevent simultaneous checkout creation for the same GHL order.
 * MySQL GET_LOCK is scoped to a dedicated pooled connection, and therefore
 * MUST be released on that same connection in finally.
 *
 * The lock is not payment evidence; callers must still check the durable
 * payments table while holding it and verify the GHL order server-side.
 */
export async function withWhopCheckoutLock<T>(
  locationId: string,
  orderId: string,
  work: () => Promise<T>,
): Promise<T> {
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(locationId) ||
      !/^[A-Za-z0-9_-]{1,255}$/.test(orderId)) {
    throw new Error('Invalid Whop checkout lock identity');
  }
  const key = 'whop:' +
    createHash('sha256').update(locationId).update('\0').update(orderId).digest('hex').slice(0, 56);
  const connection = await getPool().getConnection();
  let locked = false;
  try {
    const [rows] = await connection.query('SELECT GET_LOCK(?, 5) AS acquired', [key]);
    if (Number((rows as Array<{ acquired?: number }>)[0]?.acquired) !== 1) {
      throw new Error('Whop checkout lock could not be acquired');
    }
    locked = true;
    return await work();
  } finally {
    try {
      if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [key]);
    } finally {
      connection.release();
    }
  }
}
