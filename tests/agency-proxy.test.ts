import { parsePaginationParams, normalizeUpstreamResponse } from '../lib/agency-proxy';

describe('agency-proxy helpers', () => {
  test('parsePaginationParams defaults', () => {
    const params = new URLSearchParams('');
    const parsed = parsePaginationParams(params);
    expect(parsed.page).toBe(1);
    expect(parsed.per_page).toBe(50);
    expect(parsed.date_from).toBeNull();
    expect(parsed.date_to).toBeNull();
  });

  test('normalizeUpstreamResponse handles arrays', () => {
    const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const normalized = normalizeUpstreamResponse(arr, 1, 2);
    expect(normalized.total).toBe(3);
    expect(normalized.items.length).toBe(2);
    expect(normalized.page).toBe(1);
    expect(normalized.per_page).toBe(2);
    expect(normalized.has_more).toBe(true);
    expect(normalized.links.next).toBe(2);
  });

  test('normalizeUpstreamResponse handles object with data and total', () => {
    const upstream = { data: [{ id: 'a' }], total: 10, page: 2, per_page: 5 };
    const normalized = normalizeUpstreamResponse(upstream, 1, 50);
    expect(normalized.total).toBe(10);
    expect(normalized.page).toBe(2);
    expect(normalized.per_page).toBe(5);
    expect(Array.isArray(normalized.items)).toBeTruthy();
    expect(normalized.has_more).toBe(false);
    expect(normalized.links.next).toBeNull();
  });
});
