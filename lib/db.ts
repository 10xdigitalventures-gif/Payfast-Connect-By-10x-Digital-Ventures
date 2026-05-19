import mysql, { type FieldPacket, type QueryResult } from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host:            process.env.DB_HOST!,
      port:            parseInt(process.env.DB_PORT || '3306'),
      user:            process.env.DB_USER!,
      password:        process.env.DB_PASSWORD!,
      database:        process.env.DB_NAME!,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit:      0,
      timezone:        '+00:00',
    });
  }
  return pool;
}

// mysql2 accepts these primitive types as query values
type SqlValue = string | number | boolean | null | Date | Buffer;

export async function query<T = unknown>(
  sql: string,
  values?: SqlValue[]
): Promise<T> {
  const db = getPool();
  try {
    const [rows]: [QueryResult, FieldPacket[]] = await db.execute(sql, values);
    return rows as T;
  } catch (err: any) {
    // If the DB isn't available during build or in dev, degrade gracefully by returning
    // an empty result rather than crashing the build. This avoids hard failures when
    // Next.js prerenders pages that call server code at build time on machines without DB.
    console.warn('[DB] query failed:', err && err.message ? err.message : String(err));
    if (err && (err.code === 'ECONNREFUSED' || String(err).includes('ECONNREFUSED'))) {
      return [] as unknown as T;
    }
    // For other errors, rethrow so they're visible during development
    throw err;
  }
}

// ─── Type helpers ───────────────────────────────────────────
export interface Installation {
  id: number;
  location_id: string;
  company_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  merchant_name: string | null;
  store_id: string | null;
  merchant_id: string | null;
  merchant_key: string | null;
  passphrase: string | null;
  environment: 'live' | 'sandbox';
  tag_on_payment: string;
  tag_on_fail: string;
  move_opp_stage: string;
  auto_create_contact: number;
  fire_workflow: number;
  created_at: string;
}

export interface Payment {
  id: number;
  location_id: string;
  pf_payment_id: string;
  pf_token: string | null;
  contact_id: string | null;
  payer_email: string;
  payer_first: string;
  payer_last: string;
  amount: number;
  item_name: string;
  payment_type: 'one-time' | 'subscription';
  status: 'pending' | 'complete' | 'failed' | 'cancelled';
  synced_ghl: number;
  created_at: string;
}
