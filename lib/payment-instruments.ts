import { query } from './db';

export interface PaymentInstrument {
  id: number;
  location_id: string;
  instrument_token: string;
  instrument_alias: string | null;
  card_last_four: string | null;
  expiry_date: string | null;
  is_default: number;
  created_at: string;
}

interface SavePaymentInstrumentParams {
  instrumentToken: string;
  instrumentAlias?: string | null;
  cardLastFour?: string | null;
  expiryDate?: string | null;
  isDefault?: boolean;
}

export async function getPaymentInstruments(locationId: string): Promise<PaymentInstrument[]> {
  return query<PaymentInstrument[]>(
    `SELECT id, location_id, instrument_token, instrument_alias, card_last_four, expiry_date, is_default, created_at
     FROM payment_instruments
     WHERE location_id = ?
     ORDER BY is_default DESC, created_at DESC`,
    [locationId]
  );
}

export async function removePaymentInstrument(locationId: string, instrumentId: number) {
  await query(
    'DELETE FROM payment_instruments WHERE id = ? AND location_id = ?',
    [instrumentId, locationId]
  );
}

export async function setDefaultPaymentInstrument(locationId: string, instrumentId: number) {
  await query('UPDATE payment_instruments SET is_default = 0 WHERE location_id = ?', [locationId]);
  await query(
    'UPDATE payment_instruments SET is_default = 1 WHERE id = ? AND location_id = ?',
    [instrumentId, locationId]
  );
}

export async function savePaymentInstrument(locationId: string, params: SavePaymentInstrumentParams) {
  const existing = await query<Array<{ id: number }>>(
    'SELECT id FROM payment_instruments WHERE location_id = ? AND instrument_token = ? LIMIT 1',
    [locationId, params.instrumentToken]
  );

  if (params.isDefault) {
    await query('UPDATE payment_instruments SET is_default = 0 WHERE location_id = ?', [locationId]);
  }

  if (existing.length) {
    await query(
      `UPDATE payment_instruments
       SET instrument_alias = COALESCE(?, instrument_alias),
           card_last_four = COALESCE(?, card_last_four),
           expiry_date = COALESCE(?, expiry_date),
           is_default = ?
       WHERE id = ?`,
      [
        params.instrumentAlias || null,
        params.cardLastFour || null,
        params.expiryDate || null,
        params.isDefault ? 1 : 0,
        existing[0].id,
      ]
    );
    return existing[0].id;
  }

  const result = await query<{ insertId: number }>(
    `INSERT INTO payment_instruments
      (location_id, instrument_token, instrument_alias, card_last_four, expiry_date, is_default)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      locationId,
      params.instrumentToken,
      params.instrumentAlias || null,
      params.cardLastFour || null,
      params.expiryDate || null,
      params.isDefault ? 1 : 0,
    ]
  );

  return result.insertId;
}
