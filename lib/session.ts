export async function getSession() {
  // For unit tests we return a fixed agency session pointing to 'agency-loc'
  return { locationId: 'agency-loc', installMode: 'agency' } as any;
}

export type InstallMode = 'subaccount' | 'agency';
export const InstallMode = {
  SUBACCOUNT: 'subaccount' as InstallMode,
  AGENCY: 'agency' as InstallMode,
};

// No-op helpers used by the app; real implementations exist in the full project.
export function applySessionCookie(res: any, ...args: any[]) {
  // In real runtime this sets session cookies; shim returns response for chaining
  return res;
}

export function clearSession(res?: any) {
  // Clears session cookie in real runtime; shim is no-op and returns response if provided
  return res;
}

export function clearExistingSession(res?: any) {
  // Some routes call clearExistingSession before applying a new cookie
  return res;
}
