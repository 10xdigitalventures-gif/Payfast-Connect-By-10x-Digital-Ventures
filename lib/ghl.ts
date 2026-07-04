import { query, Installation } from './db';

const GHL_API   = 'https://services.leadconnectorhq.com';
const GHL_TOKEN = 'https://services.leadconnectorhq.com/oauth/token';
const VERSION   = '2021-07-28';

// ─── Token Management ────────────────────────────────────────

export async function getValidToken(locationId: string): Promise<string | null> {
  const rows = await query<Installation[]>(
    'SELECT * FROM installations WHERE location_id = ?',
    [locationId]
  );
  if (!rows.length) return null;

  const inst = rows[0];
  const expiresAt = new Date(inst.expires_at).getTime();
  const now = Date.now();

  // Refresh if expired or expiring in 5 mins
  if (now >= expiresAt - 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(inst.refresh_token);
    if (!refreshed) return null;

    await query(
      `UPDATE installations
       SET access_token = ?, refresh_token = ?, expires_at = ?
       WHERE location_id = ?`,
      [
        refreshed.access_token,
        refreshed.refresh_token,
        new Date(Date.now() + refreshed.expires_in * 1000),
        locationId,
      ]
    );
    return refreshed.access_token;
  }

  return inst.access_token;
}

async function refreshAccessToken(refreshToken: string) {
  try {
    const res = await fetch(GHL_TOKEN, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GHL_CLIENT_ID!,
        client_secret: process.env.GHL_CLIENT_SECRET!,
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Contacts ───────────────────────────────────────────────

export async function findContactByEmail(
  token: string,
  locationId: string,
  email: string
): Promise<{ id: string } | null> {
  const res = await fetch(
    `${GHL_API}/contacts/?locationId=${locationId}&email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${token}`, Version: VERSION } }
  );
  const data = await res.json();
  return data?.contacts?.[0] || null;
}

export async function createContact(
  token: string,
  locationId: string,
  contact: {
    email:      string;
    firstName?: string;
    lastName?:  string;
    tags?:      string[];
  }
): Promise<{ id: string } | null> {
  const res = await fetch(`${GHL_API}/contacts/`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Version:        VERSION,
    },
    body: JSON.stringify({ locationId, ...contact }),
  });
  const data = await res.json();
  return data?.contact || null;
}

export async function addTagsToContact(
  token: string,
  contactId: string,
  tags: string[]
): Promise<void> {
  await fetch(`${GHL_API}/contacts/${contactId}/tags`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Version:        VERSION,
    },
    body: JSON.stringify({ tags }),
  });
}

// ─── Opportunities ──────────────────────────────────────────

export async function getOpportunitiesByContact(
  token: string,
  locationId: string,
  contactId: string
): Promise<{ id: string; status: string }[]> {
  const res = await fetch(
    `${GHL_API}/opportunities/search?location_id=${locationId}&contact_id=${contactId}`,
    { headers: { Authorization: `Bearer ${token}`, Version: VERSION } }
  );
  const data = await res.json();
  return data?.opportunities || [];
}

export async function updateOpportunity(
  token: string,
  opportunityId: string,
  status: string
): Promise<void> {
  await fetch(`${GHL_API}/opportunities/${opportunityId}`, {
    method:  'PUT',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Version:        VERSION,
    },
    body: JSON.stringify({ status }),
  });
}

// ─── Main Payment Handler (called from ITN webhook) ──────────

export async function handlePaymentSync(params: {
  locationId:  string;
  email:       string;
  firstName:   string;
  lastName:    string;
  contactId?:  string; // if passed via custom_str1
  tags:        string[];
  oppStatus:   string;
  autoCreate:  boolean;
}): Promise<string | null> {
  const token = await getValidToken(params.locationId);
  if (!token) return null;

  let contactId = params.contactId;

  // If no contactId passed, find or create by email
  if (!contactId) {
    const existing = await findContactByEmail(token, params.locationId, params.email);
    if (existing) {
      contactId = existing.id;
    } else if (params.autoCreate) {
      const created = await createContact(token, params.locationId, {
        email:     params.email,
        firstName: params.firstName,
        lastName:  params.lastName,
        tags:      params.tags,
      });
      contactId = created?.id ?? undefined;
    }
  }

  if (!contactId) return null;

  // Add tags
  if (params.tags.length > 0) {
    await addTagsToContact(token, contactId, params.tags);
  }

  // Move open opportunities to won
  if (params.oppStatus) {
    const opps = await getOpportunitiesByContact(token, params.locationId, contactId);
    for (const opp of opps.filter(o => o.status !== 'won')) {
      await updateOpportunity(token, opp.id, params.oppStatus);
    }
  }

  return contactId;
}
