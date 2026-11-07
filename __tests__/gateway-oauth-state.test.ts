import { createGatewayOAuthState, verifyGatewayOAuthState } from '../lib/gateway-oauth-state';

const secret = 'test-only-secret-which-is-at-least-32-characters';
const nonce = 'abcdefghijklmnopqrstuvwxyzABCDEF12345678';
const now = 1794000000;

describe('gateway OAuth state', () => {
  it('accepts a correctly signed state for the same provider and nonce', () => {
    const state = createGatewayOAuthState('payfast', secret, nonce, now);
    expect(verifyGatewayOAuthState(state, 'payfast', secret, nonce, now + 5)).toBe(true);
  });
  it('rejects cross-provider use', () => {
    const state = createGatewayOAuthState('payfast', secret, nonce, now);
    expect(verifyGatewayOAuthState(state, 'whop', secret, nonce, now)).toBe(false);
  });
  it('rejects missing, mismatched and tampered state', () => {
    const state = createGatewayOAuthState('swich', secret, nonce, now);
    expect(verifyGatewayOAuthState(null, 'swich', secret, nonce, now)).toBe(false);
    expect(verifyGatewayOAuthState(state, 'swich', secret, 'differentnonceabcdefghijklmnopqrstuvwxyz12', now)).toBe(false);
    expect(verifyGatewayOAuthState(state.replace(/\\.[A-Za-z0-9_-]{43}$/, (signature) => '.' + (signature[1] === 'A' ? 'B' : 'A') + signature.slice(2)), 'swich', secret, nonce, now)).toBe(false);
  });
  it('rejects expired and future states', () => {
    const state = createGatewayOAuthState('whop', secret, nonce, now);
    expect(verifyGatewayOAuthState(state, 'whop', secret, nonce, now + 601)).toBe(false);
    expect(verifyGatewayOAuthState(state, 'whop', secret, nonce, now - 31)).toBe(false);
  });
  it('requires strong secret', () => {
    expect(() => createGatewayOAuthState('whop', 'short', nonce, now)).toThrow();
  });
});
