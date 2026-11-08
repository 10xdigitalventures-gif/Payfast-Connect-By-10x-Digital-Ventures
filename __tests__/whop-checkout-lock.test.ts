import { getPool } from '../lib/db';
import { withWhopCheckoutLock } from '../lib/whop-checkout-lock';

jest.mock('../lib/db', () => ({ getPool: jest.fn() }));
const poolMock = getPool as jest.Mock;

describe('Whop GHL checkout serialization', () => {
  let connection: { query: jest.Mock; release: jest.Mock };
  beforeEach(() => {
    connection = {
      query: jest.fn().mockResolvedValue([[{ acquired: 1 }]]),
      release: jest.fn(),
    };
    poolMock.mockReset().mockReturnValue({ getConnection: jest.fn().mockResolvedValue(connection) });
  });

  it('serializes the same order by deterministic location-scoped advisory key', async () => {
    const operation = jest.fn().mockResolvedValue('checkout-session');
    expect(await withWhopCheckoutLock('loc-A', 'order-A', operation)).toBe('checkout-session');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(connection.query).toHaveBeenCalledTimes(2);
    const [sql, args] = connection.query.mock.calls[0];
    expect(sql).toContain('GET_LOCK');
    expect(String(args[0])).toMatch(/^whop:[a-f0-9]{56}$/);
    expect(connection.query.mock.calls[1][0]).toContain('RELEASE_LOCK');
    expect(connection.query.mock.calls[1][1]).toEqual(args);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it('uses distinct keys across locations and orders', async () => {
    const keys: string[] = [];
    for (const [loc, order] of [['loc-A','order-A'], ['loc-A','order-B'], ['loc-B','order-A']]) {
      await withWhopCheckoutLock(loc, order, async () => 'done');
      keys.push(String(connection.query.mock.calls[connection.query.mock.calls.length - 2][1][0]));
    }
    expect(new Set(keys).size).toBe(3);
  });

  it('fails closed on a lock timeout without executing payment creation', async () => {
    connection.query.mockResolvedValueOnce([[{ acquired: 0 }]]);
    const work = jest.fn();
    await expect(withWhopCheckoutLock('loc-A', 'order-A', work)).rejects.toThrow('lock could not be acquired');
    expect(work).not.toHaveBeenCalled();
    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it('always releases the connection if hosted checkout creation throws', async () => {
    await expect(withWhopCheckoutLock('loc-A','order-A',async () => {
      throw new Error('provider failure');
    })).rejects.toThrow('provider failure');
    expect(connection.query).toHaveBeenCalledTimes(2);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid order keys before acquiring a database connection', async () => {
    await expect(withWhopCheckoutLock('loc-A','../order',async () => null)).rejects.toThrow('Invalid Whop');
    expect(poolMock).not.toHaveBeenCalled();
  });
});
