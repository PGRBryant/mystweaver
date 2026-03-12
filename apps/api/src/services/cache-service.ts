import { getRedis } from '../db/redis';
import { flagsCollection } from '../db/firestore';
import { config } from '../config';
import type { FlagDocument } from '../types/flag';

const CACHE_PREFIX = 'flag:';

export async function getCachedFlag(key: string): Promise<FlagDocument | null> {
  const redis = getRedis();

  // Try cache first.
  if (redis) {
    try {
      const cached = await redis.get(CACHE_PREFIX + key);
      if (cached) return JSON.parse(cached) as FlagDocument;
    } catch {
      // Cache read failed — fall through to Firestore.
    }
  }

  // Cache miss — read from Firestore.
  const doc = await flagsCollection.doc(key).get();
  if (!doc.exists) return null;

  const flag = { key: doc.id, ...doc.data() } as FlagDocument;

  // Backfill cache.
  if (redis) {
    try {
      await redis.set(
        CACHE_PREFIX + key,
        JSON.stringify(flag),
        'EX',
        config.cacheTtlSeconds,
      );
    } catch {
      // Cache write failed — non-fatal.
    }
  }

  return flag;
}

export async function invalidateFlag(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(CACHE_PREFIX + key);
    } catch {
      // Non-fatal.
    }
  }
}
