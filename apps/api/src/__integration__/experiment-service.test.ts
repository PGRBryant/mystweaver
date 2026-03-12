import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock external dependencies that require Pub/Sub and Redis.
vi.mock('../services/pubsub-service', () => ({
  publishFlagChange: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db/redis', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));

import { createFlag } from '../services/flag-service';
import {
  createExperiment,
  getExperiment,
  listExperiments,
  updateExperiment,
  deleteExperiment,
  startExperiment,
  stopExperiment,
  concludeExperiment,
} from '../services/experiment-service';
import { createTestProjectId, cleanupProject } from './setup';

const pid = createTestProjectId('experiments');

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST must be set to run integration tests');
  }
});

afterAll(async () => {
  await cleanupProject(pid);
});

/** Helper: create a flag that experiments can reference. */
async function seedFlag(key: string): Promise<void> {
  await createFlag(pid, {
    key,
    name: `Flag ${key}`,
    type: 'number',
    defaultValue: 10,
    enabled: true,
  });
}

const variants = [
  { key: 'control', value: 10, weight: 50 },
  { key: 'treatment', value: 5, weight: 50 },
];

describe('experiment-service (integration)', () => {
  beforeEach(async () => {
    await cleanupProject(pid);
  });

  // ── createExperiment ────────────────────────────────────────────────────

  it('creates a draft experiment linked to a flag', async () => {
    await seedFlag('exp-flag-01');

    const exp = await createExperiment(
      pid,
      { name: 'Timer Test', flagKey: 'exp-flag-01', variants, metric: 'room.completed' },
      'tester',
    );

    expect(exp.name).toBe('Timer Test');
    expect(exp.flagKey).toBe('exp-flag-01');
    expect(exp.status).toBe('draft');
    expect(exp.variants).toHaveLength(2);
    expect(exp.metric).toBe('room.completed');
    expect(exp.winner).toBeNull();
    expect(exp.previousFlagState).toBeNull();
  });

  it('rejects experiment for non-existent flag', async () => {
    await expect(
      createExperiment(pid, { name: 'Bad', flagKey: 'no-flag', variants, metric: 'm' }, 'tester'),
    ).rejects.toThrow('not found');
  });

  it('rejects variants that do not sum to 100', async () => {
    await seedFlag('exp-flag-bad');
    const badVariants = [
      { key: 'a', value: 1, weight: 30 },
      { key: 'b', value: 2, weight: 30 },
    ];
    await expect(
      createExperiment(pid, { name: 'Bad', flagKey: 'exp-flag-bad', variants: badVariants, metric: 'm' }, 'tester'),
    ).rejects.toThrow('sum to 100');
  });

  // ── getExperiment / listExperiments ─────────────────────────────────────

  it('gets experiment by id', async () => {
    await seedFlag('exp-flag-02');
    const created = await createExperiment(
      pid,
      { name: 'Get Test', flagKey: 'exp-flag-02', variants, metric: 'm' },
      'tester',
    );

    const fetched = await getExperiment(pid, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Get Test');
  });

  it('returns null for non-existent experiment', async () => {
    const fetched = await getExperiment(pid, 'nonexistent-id');
    expect(fetched).toBeNull();
  });

  it('lists experiments', async () => {
    await seedFlag('exp-flag-03');
    await createExperiment(pid, { name: 'E1', flagKey: 'exp-flag-03', variants, metric: 'm' }, 'tester');
    await createExperiment(pid, { name: 'E2', flagKey: 'exp-flag-03', variants, metric: 'm' }, 'tester');

    const list = await listExperiments(pid);
    expect(list).toHaveLength(2);
  });

  // ── updateExperiment ────────────────────────────────────────────────────

  it('updates a draft experiment', async () => {
    await seedFlag('exp-flag-04');
    const exp = await createExperiment(
      pid,
      { name: 'Original', flagKey: 'exp-flag-04', variants, metric: 'm' },
      'tester',
    );

    const updated = await updateExperiment(pid, exp.id, { name: 'Renamed' }, 'tester');
    expect(updated.name).toBe('Renamed');
  });

  it('rejects update to non-existent experiment', async () => {
    await expect(updateExperiment(pid, 'no-id', { name: 'X' }, 'tester')).rejects.toThrow('not found');
  });

  // ── deleteExperiment ────────────────────────────────────────────────────

  it('deletes a draft experiment', async () => {
    await seedFlag('exp-flag-05');
    const exp = await createExperiment(
      pid,
      { name: 'Delete Me', flagKey: 'exp-flag-05', variants, metric: 'm' },
      'tester',
    );

    await deleteExperiment(pid, exp.id);
    const fetched = await getExperiment(pid, exp.id);
    expect(fetched).toBeNull();
  });

  // ── Lifecycle: start → stop ─────────────────────────────────────────────

  it('starts a draft experiment (injects rules into flag)', async () => {
    await seedFlag('exp-flag-06');
    const exp = await createExperiment(
      pid,
      { name: 'Start Test', flagKey: 'exp-flag-06', variants, metric: 'm' },
      'tester',
    );

    const started = await startExperiment(pid, exp.id, 'tester');
    expect(started.status).toBe('running');
    expect(started.previousFlagState).not.toBeNull();
    expect(started.previousFlagState!.defaultValue).toBe(10);
    expect(started.previousFlagState!.rules).toEqual([]);
  });

  it('stops a running experiment (reverts flag to previous state)', async () => {
    await seedFlag('exp-flag-07');
    const exp = await createExperiment(
      pid,
      { name: 'Stop Test', flagKey: 'exp-flag-07', variants, metric: 'm' },
      'tester',
    );
    await startExperiment(pid, exp.id, 'tester');

    const stopped = await stopExperiment(pid, exp.id, 'tester');
    expect(stopped.status).toBe('stopped');
  });

  it('rejects starting a non-draft experiment', async () => {
    await seedFlag('exp-flag-08');
    const exp = await createExperiment(
      pid,
      { name: 'Already Running', flagKey: 'exp-flag-08', variants, metric: 'm' },
      'tester',
    );
    await startExperiment(pid, exp.id, 'tester');

    await expect(startExperiment(pid, exp.id, 'tester')).rejects.toThrow('Cannot start');
  });

  it('rejects deleting a running experiment', async () => {
    await seedFlag('exp-flag-09');
    const exp = await createExperiment(
      pid,
      { name: 'No Delete', flagKey: 'exp-flag-09', variants, metric: 'm' },
      'tester',
    );
    await startExperiment(pid, exp.id, 'tester');

    await expect(deleteExperiment(pid, exp.id)).rejects.toThrow('Only draft');
  });

  // ── Lifecycle: start → conclude ─────────────────────────────────────────

  it('concludes a running experiment (promotes winner value)', async () => {
    await seedFlag('exp-flag-10');
    const exp = await createExperiment(
      pid,
      { name: 'Conclude Test', flagKey: 'exp-flag-10', variants, metric: 'm' },
      'tester',
    );
    await startExperiment(pid, exp.id, 'tester');

    const concluded = await concludeExperiment(pid, exp.id, 'treatment', 'tester');
    expect(concluded.status).toBe('concluded');
    expect(concluded.winner).toBe('treatment');
  });

  it('rejects concluding with invalid winner key', async () => {
    await seedFlag('exp-flag-11');
    const exp = await createExperiment(
      pid,
      { name: 'Bad Winner', flagKey: 'exp-flag-11', variants, metric: 'm' },
      'tester',
    );
    await startExperiment(pid, exp.id, 'tester');

    await expect(concludeExperiment(pid, exp.id, 'nonexistent', 'tester')).rejects.toThrow('not found');
  });
});
