import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Lightweight in-memory TTL cache for expensive read-only queries (analytics
 * aggregations, admin counters). Single-process only — matches the current
 * single-instance deployment; entries self-expire, and writers can bust keys
 * by prefix after mutations.
 */
@Injectable()
export class TtlCacheService {
  private readonly store = new Map<string, CacheEntry>();

  /** Get a cached value, or compute and cache it for `ttlMs`. */
  async getOrSet<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;

    const value = await compute();
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });

    // Opportunistic cleanup so the map never grows unbounded.
    if (this.store.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (v.expiresAt <= now) this.store.delete(k);
      }
    }
    return value;
  }

  /** Remove every entry whose key starts with the given prefix. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
