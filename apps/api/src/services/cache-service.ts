import { flagsCollection } from '../db/firestore';
import { config } from '../config';
import { metrics } from '../metrics';
import type { FlagDocument } from '../types/flag';

/**
 * Simple in-memory LRU cache for server-side flag evaluation fallback.
 * Replaces Redis — no external dependency, per-instance only.
 */

interface CacheEntry {
  flag: FlagDocument;
  expiresAt: number;
}

const MAX_ENTRIES = 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(projectId: string, flagKey: string): string {
  return `flag:${projectId}:${flagKey}`;
}

function evictIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES) return;
  // Delete the oldest entry (first inserted — Map preserves insertion order)
  const firstKey = cache.keys().next().value;
  if (firstKey) cache.delete(firstKey);
}

export async function getCachedFlag(projectId: string, key: string): Promise<FlagDocument | null> {
  const k = cacheKey(projectId, key);
  const entry = cache.get(k);

  if (entry && entry.expiresAt > Date.now()) {
    // Move to end (most recently used)
    cache.delete(k);
    cache.set(k, entry);
    metrics.cacheHitsTotal.inc();
    return entry.flag;
  }

  // Expired or missing — remove stale entry
  if (entry) cache.delete(k);
  metrics.cacheMissesTotal.inc();

  // Read from Firestore.
  const doc = await flagsCollection(projectId).doc(key).get();
  if (!doc.exists) return null;

  const flag = { key: doc.id, ...doc.data() } as FlagDocument;
  if (flag.deletedAt) return null;

  // Backfill cache.
  cache.set(k, {
    flag,
    expiresAt: Date.now() + config.cacheTtlSeconds * 1000,
  });
  evictIfNeeded();

  return flag;
}

export function invalidateFlag(projectId: string, key: string): void {
  cache.delete(cacheKey(projectId, key));
}
