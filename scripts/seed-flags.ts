/**
 * Seed script for MystWeaver — populates a local Firestore emulator with
 * the complete Room 404 flag set, experiments, and a test SDK key.
 *
 * Usage:
 *   npm run seed
 *
 * Prerequisites:
 *   - Firestore emulator running on localhost:8080 (docker-compose up -d)
 *   - FIRESTORE_EMULATOR_HOST=localhost:8080 set in env (the npm script handles this)
 *
 * This script is idempotent — safe to run multiple times. Existing flags are
 * overwritten with seed values; the test SDK key is only created if it doesn't exist.
 */

import { Firestore, FieldValue } from '@google-cloud/firestore';
import { createHash, randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ID = 'mystweaver-local';
const SEED_PROJECT_ID = 'room-404';

const db = new Firestore({ projectId: PROJECT_ID });
const flagsCollection = db.collection(`projects/${SEED_PROJECT_ID}/flags`);
const sdkKeysCollection = db.collection('sdk-keys');
const experimentsCollection = db.collection(`projects/${SEED_PROJECT_ID}/experiments`);

// ---------------------------------------------------------------------------
// Room 404 Flag Definitions
// ---------------------------------------------------------------------------

interface FlagSeed {
  key: string;
  name: string;
  type: 'boolean' | 'number' | 'string' | 'json';
  defaultValue: unknown;
  description: string;
  tags: string[];
}

const FLAGS: FlagSeed[] = [
  // Boolean flags — rooms
  { key: 'rooms.parry-enabled', name: 'Parry Room Enabled', type: 'boolean', defaultValue: true, description: 'Enable the Parry room type', tags: ['rooms'] },
  { key: 'rooms.leak-enabled', name: 'Leak Room Enabled', type: 'boolean', defaultValue: true, description: 'Enable the Leak room type', tags: ['rooms'] },
  { key: 'rooms.hold-still-enabled', name: 'Hold Still Room Enabled', type: 'boolean', defaultValue: true, description: 'Enable the Hold Still room type', tags: ['rooms'] },
  { key: 'rooms.ai-prompt-enabled', name: 'AI Prompt Room Enabled', type: 'boolean', defaultValue: false, description: 'Enable the AI Prompt room type', tags: ['rooms', 'ai'] },
  { key: 'rooms.mirror-enabled', name: 'Mirror Room Enabled', type: 'boolean', defaultValue: false, description: 'Enable the Mirror room type', tags: ['rooms'] },

  // Boolean flags — powerups
  { key: 'powerups.jetpack-enabled', name: 'Jetpack Powerup', type: 'boolean', defaultValue: true, description: 'Enable Jetpack powerup in vending machine', tags: ['powerups'] },
  { key: 'powerups.bonsai-enabled', name: 'Bonsai Powerup', type: 'boolean', defaultValue: true, description: 'Enable Bonsai powerup in vending machine', tags: ['powerups'] },
  { key: 'powerups.merge-conflict-enabled', name: 'Merge Conflict Powerup', type: 'boolean', defaultValue: true, description: 'Enable Merge Conflict powerup', tags: ['powerups'] },
  { key: 'powerups.fork-bomb-enabled', name: 'Fork Bomb Powerup', type: 'boolean', defaultValue: true, description: 'Enable Fork Bomb powerup', tags: ['powerups'] },
  { key: 'powerups.cursed-bonsai-enabled', name: 'Cursed Bonsai Powerup', type: 'boolean', defaultValue: true, description: 'Enable Cursed Bonsai powerup', tags: ['powerups'] },

  // Boolean flags — game mechanics
  { key: 'game.rubberband-enabled', name: 'Rubberband Mechanic', type: 'boolean', defaultValue: true, description: 'Enable rubberband catch-up mechanic', tags: ['game'] },
  { key: 'game.sabotage-mode', name: 'Sabotage Mode', type: 'boolean', defaultValue: false, description: 'Enable sabotage mode gameplay', tags: ['game'] },
  { key: 'game.audience-vote-enabled', name: 'Audience Vote', type: 'boolean', defaultValue: false, description: 'Enable audience voting on room outcomes', tags: ['game'] },
  { key: 'game.kill-switch-room', name: 'Room Kill Switch', type: 'boolean', defaultValue: false, description: 'Emergency kill switch to disable all rooms', tags: ['game', 'ops'] },

  // Number flags
  { key: 'game.task-timer-seconds', name: 'Task Timer', type: 'number', defaultValue: 8, description: 'Seconds allowed per task', tags: ['game'] },
  { key: 'game.lives-per-floor', name: 'Lives Per Floor', type: 'number', defaultValue: 3, description: 'Number of lives per floor', tags: ['game'] },
  { key: 'game.max-players', name: 'Max Players', type: 'number', defaultValue: 100, description: 'Maximum players per game session', tags: ['game'] },
  { key: 'game.rubberband-multiplier', name: 'Rubberband Multiplier', type: 'number', defaultValue: 2.0, description: 'Score multiplier for rubberband mechanic', tags: ['game'] },
  { key: 'game.total-floors', name: 'Total Floors', type: 'number', defaultValue: 15, description: 'Number of floors in a game', tags: ['game'] },
  { key: 'game.vending-machine-base-rate', name: 'Vending Machine Base Rate', type: 'number', defaultValue: 0.10, description: 'Base probability of vending machine spawn', tags: ['game', 'powerups'] },

  // String flags
  { key: 'ai.chaos-room-difficulty', name: 'Chaos Room Difficulty', type: 'string', defaultValue: 'weird', description: 'AI chaos room difficulty level', tags: ['ai'] },
  { key: 'ai.room-flavor-model', name: 'Room Flavor Model', type: 'string', defaultValue: 'fast', description: 'Which AI model to use for room flavor text', tags: ['ai'] },
  { key: 'ai.procedural-seed-strategy', name: 'Procedural Seed Strategy', type: 'string', defaultValue: 'balanced', description: 'Strategy for procedural generation seeding', tags: ['ai'] },

  // JSON flags
  {
    key: 'game.tier-weights',
    name: 'Tier Weights',
    type: 'json',
    defaultValue: { legendary: 0.05, epic: 0.15, rare: 0.25, common: 0.35, cursed: 0.20 },
    description: 'Probability weights for item tiers',
    tags: ['game'],
  },
];

// ---------------------------------------------------------------------------
// Experiments
// ---------------------------------------------------------------------------

interface ExperimentSeed {
  id: string;
  name: string;
  flagKey: string;
  variants: { key: string; value: unknown; weight: number }[];
  metric: string;
}

const EXPERIMENTS: ExperimentSeed[] = [
  {
    id: 'experiment-task-timer',
    name: 'Task Timer Experiment',
    flagKey: 'game.task-timer-seconds',
    variants: [
      { key: '8-seconds', value: 8, weight: 50 },
      { key: '5-seconds', value: 5, weight: 50 },
    ],
    metric: 'room.completed',
  },
  {
    id: 'experiment-vending-reveal',
    name: 'Vending Reveal Animation Experiment',
    flagKey: 'powerups.vending-reveal-style',
    variants: [
      { key: 'dramatic', value: 'dramatic', weight: 50 },
      { key: 'instant', value: 'instant', weight: 50 },
    ],
    metric: 'powerup.satisfaction',
  },
];

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedFlags(): Promise<void> {
  console.log(`Seeding ${FLAGS.length} flags into project "${SEED_PROJECT_ID}"...`);

  const batch = db.batch();
  const now = FieldValue.serverTimestamp();

  for (const flag of FLAGS) {
    const ref = flagsCollection.doc(flag.key);
    batch.set(ref, {
      key: flag.key,
      name: flag.name,
      description: flag.description,
      type: flag.type,
      defaultValue: flag.defaultValue,
      enabled: true,
      rules: [],
      tags: flag.tags,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-script',
    });
  }

  await batch.commit();
  console.log(`  ✓ ${FLAGS.length} flags seeded`);
}

async function seedExperiments(): Promise<void> {
  console.log(`Seeding ${EXPERIMENTS.length} experiments...`);

  const batch = db.batch();
  const now = FieldValue.serverTimestamp();

  for (const exp of EXPERIMENTS) {
    const ref = experimentsCollection.doc(exp.id);
    batch.set(ref, {
      id: exp.id,
      name: exp.name,
      flagKey: exp.flagKey,
      variants: exp.variants,
      metric: exp.metric,
      status: 'draft',
      createdBy: 'seed-script',
      createdAt: now,
    });
  }

  await batch.commit();
  console.log(`  ✓ ${EXPERIMENTS.length} experiments seeded`);
}

async function seedSDKKey(): Promise<void> {
  const TEST_KEY_ID = 'seed-test-key';
  const existingDoc = await sdkKeysCollection.doc(TEST_KEY_ID).get();

  if (existingDoc.exists && !existingDoc.data()?.revokedAt) {
    console.log('  ✓ Test SDK key already exists (skipping)');
    console.log('    Key ID: seed-test-key');
    console.log('    Note: Raw key was printed on first creation only');
    return;
  }

  // Generate a raw key with a recognizable prefix
  const rawKey = `mw_sdk_test_${randomBytes(24).toString('hex')}`;
  const hashedKey = createHash('sha256').update(rawKey).digest('hex');

  await sdkKeysCollection.doc(TEST_KEY_ID).set({
    id: TEST_KEY_ID,
    name: 'Room 404 Test Key',
    projectId: SEED_PROJECT_ID,
    hashedKey,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
    revokedAt: null,
  });

  console.log('  ✓ Test SDK key created');
  console.log('');
  console.log('  ┌──────────────────────────────────────────────────────────────┐');
  console.log('  │  SDK KEY (save this — it will not be shown again):           │');
  console.log(`  │  ${rawKey}  │`);
  console.log('  └──────────────────────────────────────────────────────────────┘');
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('');
  console.log('MystWeaver Seed Script');
  console.log('═════════════════════════════════════════');
  console.log(`Target: Firestore at ${process.env.FIRESTORE_EMULATOR_HOST ?? '(production — are you sure?)'}`);
  console.log('');

  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('ERROR: FIRESTORE_EMULATOR_HOST is not set.');
    console.error('This script should only run against the Firestore emulator.');
    console.error('Run: docker-compose up -d');
    console.error('Then: FIRESTORE_EMULATOR_HOST=localhost:8080 npm run seed');
    process.exit(1);
  }

  await seedFlags();
  await seedExperiments();
  await seedSDKKey();

  console.log('═════════════════════════════════════════');
  console.log('Seed complete.');
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
