import { query } from "./db";

export interface PaymentInstrument {
  id: number;
  location_id: string;
  contact_id: string | null;
  provider: "payfast" | "whop";
  provider_customer_id: string | null;
  provider_payment_method_id: string | null;
  instrument_token: string;
  instrument_alias: string | null;
  card_last_four: string | null;
  expiry_date: string | null;
  is_default: number;
  created_at: string;
}

interface SavePaymentInstrumentParams {
  contactId?: string | null;
  provider?: "payfast" | "whop";
  providerCustomerId?: string | null;
  providerPaymentMethodId?: string | null;
  instrumentToken: string;
  instrumentAlias?: string | null;
  cardLastFour?: string | null;
  expiryDate?: string | null;
  isDefault?: boolean;
}

const columns = `id, location_id, contact_id, provider, provider_customer_id,
  provider_payment_method_id, instrument_token, instrument_alias, card_last_four,
  expiry_date, is_default, created_at`;

/** Returns payment methods for a specific CRM contact when contactId is supplied. */
export async function getPaymentInstruments(
  locationId: string,
  contactId?: string | null,
): Promise<PaymentInstrument[]> {
  const where = contactId
    ? "WHERE location_id = ? AND contact_id = ?"
    : "WHERE location_id = ?";
  const values = contactId ? [locationId, contactId] : [locationId];
  return query<PaymentInstrument[]>(
    `SELECT ${columns} FROM payment_instruments ${where}
     ORDER BY is_default DESC, created_at DESC`,
    values,
  );
}

export async function getPaymentInstrumentByProviderMethod(
  locationId: string,
  contactId: string,
  provider: string,
  paymentMethodId: string,
) {
  const rows = await query<PaymentInstrument[]>(
    `SELECT ${columns} FROM payment_instruments
     WHERE location_id = ? AND contact_id = ? AND provider = ?
       AND provider_payment_method_id = ? LIMIT 1`,
    [locationId, contactId, provider, paymentMethodId],
  );
  return rows[0] || null;
}

export async function removePaymentInstrument(
  locationId: string,
  instrumentId: number,
) {
  await query(
    "DELETE FROM payment_instruments WHERE id = ? AND location_id = ?",
    [instrumentId, locationId],
  );
}

export async function setDefaultPaymentInstrument(
  locationId: string,
  instrumentId: number,
) {
  await query(
    "UPDATE payment_instruments SET is_default = 0 WHERE location_id = ?",
    [locationId],
  );
  await query(
    "UPDATE payment_instruments SET is_default = 1 WHERE id = ? AND location_id = ?",
    [instrumentId, locationId],
  );
}

/**
 * Upserts a tokenized method without ever crossing contact boundaries.
 * Older PayFast instruments keep working with provider=payfast/contact_id=NULL.
 */
export async function savePaymentInstrument(
  locationId: string,
  params: SavePaymentInstrumentParams,
) {
  const provider = params.provider || "payfast";
  const contactId = params.contactId || null;
  const providerMethodId =
    params.providerPaymentMethodId ||
    (provider === "whop" ? params.instrumentToken : null);
  const existing = await query<Array<{ id: number }>>(
    `SELECT id FROM payment_instruments
     WHERE location_id = ? AND provider = ? AND COALESCE(contact_id, '') = COALESCE(?, '')
       AND (provider_payment_method_id = ? OR instrument_token = ?) LIMIT 1`,
    [locationId, provider, contactId, providerMethodId, params.instrumentToken],
  );

  if (params.isDefault && contactId) {
    await query(
      "UPDATE payment_instruments SET is_default = 0 WHERE location_id = ? AND contact_id = ?",
      [locationId, contactId],
    );
  }

  if (existing.length) {
    await query(
      `UPDATE payment_instruments SET
        contact_id = COALESCE(?, contact_id), provider = ?,
        provider_customer_id = COALESCE(?, provider_customer_id),
        provider_payment_method_id = COALESCE(?, provider_payment_method_id),
        instrument_alias = COALESCE(?, instrument_alias),
        card_last_four = COALESCE(?, card_last_four), expiry_date = COALESCE(?, expiry_date),
        is_default = ? WHERE id = ?`,
      [
        contactId,
        provider,
        params.providerCustomerId || null,
        providerMethodId,
        params.instrumentAlias || null,
        params.cardLastFour || null,
        params.expiryDate || null,
        params.isDefault ? 1 : 0,
        existing[0].id,
      ],
    );
    return existing[0].id;
  }

  const result = await query<{ insertId: number }>(
    `INSERT INTO payment_instruments
      (location_id, contact_id, provider, provider_customer_id, provider_payment_method_id,
       instrument_token, instrument_alias, card_last_four, expiry_date, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      locationId,
      contactId,
      provider,
      params.providerCustomerId || null,
      providerMethodId,
      params.instrumentToken,
      params.instrumentAlias || null,
      params.cardLastFour || null,
      params.expiryDate || null,
      params.isDefault ? 1 : 0,
    ],
  );
  return result.insertId;
}
