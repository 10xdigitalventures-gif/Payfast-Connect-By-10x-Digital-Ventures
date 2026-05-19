import { query } from './db';

export type PublicPaySourceKind = 'payment_link' | 'text2pay' | 'invoice' | 'order_form' | 'schedule_installment';

export interface PublicPaySource {
  kind: PublicPaySourceKind;
  data: Record<string, any>;
}

export async function resolvePublicPaySource(token: string): Promise<PublicPaySource | null> {
  const links = await query<any[]>(
    `SELECT pl.*, i.merchant_id, i.merchant_key, i.passphrase, i.environment
     FROM payment_links pl
     JOIN installations i ON i.location_id = pl.location_id
     WHERE pl.token = ? AND pl.is_active = 1`,
    [token]
  );

  if (links[0]) return { kind: 'payment_link', data: links[0] };

  const text2pay = await query<any[]>(
    `SELECT t.*, i.merchant_id, i.merchant_key, i.passphrase, i.environment
     FROM text2pay t
     JOIN installations i ON i.location_id = t.location_id
     WHERE t.token = ? AND t.status IN ('sent','viewed')`,
    [token]
  );

  if (text2pay[0]) return { kind: 'text2pay', data: text2pay[0] };

  const invoices = await query<any[]>(
    `SELECT inv.*, i.merchant_id, i.merchant_key, i.passphrase, i.environment
     FROM invoices inv
     JOIN installations i ON i.location_id = inv.location_id
     WHERE inv.token = ? AND inv.status IN ('sent','viewed','overdue')`,
    [token]
  );

  if (invoices[0]) return { kind: 'invoice', data: invoices[0] };

  const orderForms = await query<any[]>(
    `SELECT o.*, i.merchant_id, i.merchant_key, i.passphrase, i.environment
     FROM order_forms o
     JOIN installations i ON i.location_id = o.location_id
     WHERE o.token = ? AND o.is_active = 1`,
    [token]
  );

  if (orderForms[0]) return { kind: 'order_form', data: orderForms[0] };

  const installments = await query<any[]>(
    `SELECT
       si.*,
       ps.location_id,
       ps.client_name,
       ps.client_email,
       ps.contact_id,
       ps.description,
       CONCAT('Installment ', si.installment_num, ' of ', ps.installments) AS title,
       ps.installments,
       i.merchant_id,
       i.merchant_key,
       i.passphrase,
       i.environment
     FROM schedule_installments si
     JOIN payment_schedules ps ON ps.id = si.schedule_id
     JOIN installations i ON i.location_id = ps.location_id
     WHERE si.token = ?
       AND si.status IN ('pending','sent','overdue')
       AND ps.status = 'active'`,
    [token]
  );

  if (installments[0]) return { kind: 'schedule_installment', data: installments[0] };

  return null;
}

export function encodePublicPayMeta(meta: { kind: PublicPaySourceKind; id: number; couponCode?: string | null }) {
  const parts = [`src=${meta.kind}:${meta.id}`];

  if (meta.couponCode) {
    parts.push(`coupon=${encodeURIComponent(meta.couponCode)}`);
  }

  return parts.join('|');
}

export function parsePublicPayMeta(raw?: string | null) {
  if (!raw) return null;

  const entries = Object.fromEntries(
    raw.split('|').map((part) => {
      const [key, value = ''] = part.split('=');
      return [key, decodeURIComponent(value)];
    })
  );

  const source = entries.src;
  if (!source) return null;

  const [kind, id] = source.split(':');
  if (!kind || !id) return null;

  return {
    kind: kind as PublicPaySourceKind,
    id: Number(id),
    couponCode: entries.coupon || null,
  };
}
