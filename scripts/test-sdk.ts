/**
 * Quick integration test for the SDK against a running local API.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/test-sdk.ts <sdk-key>
 */

import { MystweaverClient } from '../packages/sdk-js/src/client';

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Usage: npx tsx scripts/test-sdk.ts <sdk-key>');
  process.exit(1);
}

const client = new MystweaverClient({
  apiKey,
  baseUrl: 'http://localhost:3000',
  defaults: { 'fallback-flag': 999 },
});

const ctx = { id: 'test-user', attributes: { tier: 'gold' } };

async function main() {
  console.log('\n--- Single flag evaluation ---');
  const timer = await client.value('game.task-timer-seconds', ctx, 8);
  console.log('game.task-timer-seconds:', timer);

  const jetpack = await client.flag('powerups.jetpack-enabled', ctx);
  console.log('powerups.jetpack-enabled:', jetpack);

  const difficulty = await client.value('ai.chaos-room-difficulty', ctx, 'unknown');
  console.log('ai.chaos-room-difficulty:', difficulty);

  console.log('\n--- JSON flag ---');
  const weights = await client.json('game.tier-weights', ctx, {});
  console.log('game.tier-weights:', weights);

  console.log('\n--- Bulk evaluation ---');
  const all = await client.evaluateAll(
    ['game.task-timer-seconds', 'game.lives-per-floor', 'powerups.jetpack-enabled', 'nonexistent-flag'],
    ctx,
  );
  console.log('bulk results:', all);

  console.log('\n--- Event tracking ---');
  client.track('room.completed', 'test-user', { floor: 3, roomType: 'leak' });
  client.track('powerup.used', 'test-user', { powerup: 'jetpack' });
  await client.flush();
  console.log('2 events tracked and flushed');

  console.log('\n--- Fallback (unknown flag) ---');
  const fallback = await client.value('fallback-flag', ctx, 0);
  console.log('fallback-flag (should be 999 from defaults):', fallback);

  await client.close();
  console.log('\n✓ All checks passed\n');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
