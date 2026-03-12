import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;
  try {
    redis = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis connection error, disabling cache');
      redis?.disconnect();
      redis = null;
    });
    return redis;
  } catch {
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
