import { getValidToken } from './ghl';

const GHL_API = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

async function ghlRequest(path: string, token: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  const res = await fetch(`${GHL_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(typeof data === 'string' ? data : data?.message || data?.error || `GHL Marketplace request failed: ${res.status}`);
  }

  return data;
}

export async function createWalletCharge(locationId: string, chargeData: {
  amount: number;
  currency: string;
  description: string;
}) {
  const token = await getValidToken(locationId);
  if (!token) throw new Error('Failed to retrieve a valid GHL access token');
  
  return ghlRequest('/marketplace/charges', token, 'POST', {
    ...chargeData,
    locationId,
  });
}

export async function checkSufficientFunds(locationId: string, amount: number) {
  const token = await getValidToken(locationId);
  if (!token) throw new Error('Failed to retrieve a valid GHL access token');
  
  return ghlRequest(`/marketplace/has-funds?locationId=${locationId}&amount=${amount}`, token, 'GET');
}

export async function getAppBillingConfig(locationId: string) {
  const token = await getValidToken(locationId);
  if (!token) throw new Error('Failed to retrieve a valid GHL access token');
  
  return ghlRequest(`/marketplace/rebilling-config`, token, 'GET');
}
