import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const required = ['business_name', 'city', 'email', 'phone', 'username'];
  for (const field of required) {
    if (!body[field]?.toString().trim()) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  const result = await query<any>(
    `INSERT INTO merchant_applications (
      full_name, username, id_number, email, phone,
      business_name, business_type, registration_number, vat_number, website, business_category,
      monthly_turnover, business_description, address_line1, address_line2, city, province,
      postal_code, country, bank_name, account_holder, account_number, account_type, branch_code,
      ghl_location_id, integration_platform, admin_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      (body.full_name || body.business_name).trim(),
      body.username.trim(),
      body.id_number || null,
      body.email.trim(),
      body.phone.trim(),
      body.business_name.trim(),
      body.business_type || 'other',
      body.registration_number || null,
      body.vat_number || null,
      body.website || null,
      body.business_category || null,
      body.monthly_turnover || null,
      body.business_description || null,
      body.address_line1 || null,
      body.address_line2 || null,
      body.city || null,
      body.province || null,
      body.postal_code || null,
      body.country || 'Pakistan',
      body.bank_name || null,
      body.account_holder || null,
      body.account_number || null,
      body.account_type || 'cheque',
      body.branch_code || null,
      body.ghl_location_id || null,
      body.integration_platform || null,
      body.additional_information || null,
    ]
  );

  return NextResponse.json({ success: true, id: result.insertId });
}
