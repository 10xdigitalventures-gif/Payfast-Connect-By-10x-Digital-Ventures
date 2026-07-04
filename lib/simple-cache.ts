type CacheEntry = { expiresAt: number; value: any };

const store = new Map<string, CacheEntry>();

export function setCache(key: string, value: any, ttlSeconds = 30) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  store.set(key, { expiresAt, value });
}

export function getCache<T = any>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function clearCache() {
  store.clear();
}
