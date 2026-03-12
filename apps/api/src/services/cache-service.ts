import { getRedis } from '../db/redis';
import { flagsCollection } from '../db/firestore';
import { config } from '../config';
import { metrics } from '../metrics';
import type { FlagDocument } from '../types/flag';

function cacheKey(projectId: string, flagKey: string): string {
  return `flag:${projectId}:${flagKey}`;
}

export async function getCachedFlag(projectId: string, key: string): Promise<FlagDocument | null> {
  const redis = getRedis();

  // Try cache first.
  if (redis) {
    try {
      const cached = await redis.get(cacheKey(projectId, key));
      if (cached) {
        metrics.cacheHitsTotal.inc();
        return JSON.parse(cached) as FlagDocument;
      }
    } catch {
      // Cache read failed — fall through to Firestore.
    }
  }

  metrics.cacheMissesTotal.inc();

  // Cache miss — read from Firestore.
  const doc = await flagsCollection(projectId).doc(key).get();
  if (!doc.exists) return null;

  const flag = { key: doc.id, ...doc.data() } as FlagDocument;

  // Skip soft-deleted flags.
  if (flag.deletedAt) return null;

  // Backfill cache.
  if (redis) {
    try {
      await redis.set(cacheKey(projectId, key), JSON.stringify(flag), 'EX', config.cacheTtlSeconds);
    } catch {
      // Cache write failed — non-fatal.
    }
  }

  return flag;
}

export async function invalidateFlag(projectId: string, key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(cacheKey(projectId, key));
    } catch {
      // Non-fatal.
    }
  }
}
