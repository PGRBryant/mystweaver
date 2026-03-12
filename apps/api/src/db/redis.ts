import Redis from 'ioredis';
import { config } from '../config';

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
      console.warn('[redis] connection error, disabling cache:', err.message);
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
