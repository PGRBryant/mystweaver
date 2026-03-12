import { flagUpdatesTopic, pubsub } from '../db/pubsub';
import { config } from '../config';
import { invalidateFlag } from './cache-service';
import type { Subscription } from '@google-cloud/pubsub';

let subscription: Subscription | null = null;

interface FlagChangeMessage {
  flagKey: string;
  action: 'update' | 'delete';
}

export async function publishFlagChange(
  flagKey: string,
  action: 'update' | 'delete',
): Promise<void> {
  try {
    await flagUpdatesTopic.publishMessage({
      json: { flagKey, action } satisfies FlagChangeMessage,
    });
  } catch (err) {
    console.warn('[pubsub] failed to publish flag change:', err);
  }
}

export async function startSubscription(): Promise<void> {
  try {
    const subName = config.pubsubSubscription;
    const [sub] = await pubsub
      .subscription(subName)
      .get({ autoCreate: true });

    subscription = sub;

    sub.on('message', (message) => {
      try {
        const data = JSON.parse(message.data.toString()) as FlagChangeMessage;
        invalidateFlag(data.flagKey).catch(() => {});
      } catch {
        // Malformed message — ack and move on.
      }
      message.ack();
    });

    sub.on('error', (err) => {
      console.warn('[pubsub] subscription error:', err.message);
    });

    console.log(`[pubsub] listening on subscription "${subName}"`);
  } catch (err) {
    console.warn('[pubsub] could not start subscription (non-fatal):', err);
  }
}

export async function stopSubscription(): Promise<void> {
  if (subscription) {
    await subscription.close();
    subscription = null;
  }
}
