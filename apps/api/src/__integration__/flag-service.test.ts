import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock external dependencies that require Pub/Sub.
vi.mock('../services/pubsub-service', () => ({
  publishFlagChange: vi.fn().mockResolvedValue(undefined),
}));

import {
  createFlag,
  getFlag,
  listFlags,
  updateFlag,
  replaceFlag,
  deleteFlag,
} from '../services/flag-service';
import { createTestProjectId, cleanupProject } from './setup';

const pid = createTestProjectId('flags');

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST must be set to run integration tests');
  }
});

afterAll(async () => {
  await cleanupProject(pid);
});

describe('flag-service (integration)', () => {
  beforeEach(async () => {
    await cleanupProject(pid);
  });

  // ── createFlag ──────────────────────────────────────────────────────────

  it('creates a boolean flag and reads it back', async () => {
    const flag = await createFlag(pid, {
      key: 'test-flag',
      name: 'Test Flag',
      type: 'boolean',
      defaultValue: false,
    });

    expect(flag.key).toBe('test-flag');
    expect(flag.name).toBe('Test Flag');
    expect(flag.type).toBe('boolean');
    expect(flag.defaultValue).toBe(false);
    expect(flag.enabled).toBe(true);
    expect(flag.tags).toEqual([]);
    expect(flag.rules).toEqual([]);
    expect(flag.deletedAt).toBeNull();

    const fetched = await getFlag(pid, 'test-flag');
    expect(fetched).not.toBeNull();
    expect(fetched!.key).toBe('test-flag');
    expect(fetched!.name).toBe('Test Flag');
  });

  it('creates a flag with all optional fields', async () => {
    const flag = await createFlag(pid, {
      key: 'full-flag',
      name: 'Full Flag',
      type: 'number',
      defaultValue: 42,
      description: 'A fully specified flag',
      enabled: false,
      rules: [
        {
          id: 'r1',
          description: 'Pro users',
          conditions: [{ attribute: 'plan', operator: 'eq', value: 'pro' }],
          value: 100,
          rolloutPercentage: 50,
        },
      ],
      tags: ['game', 'timer'],
    });

    expect(flag.description).toBe('A fully specified flag');
    expect(flag.enabled).toBe(false);
    expect(flag.rules).toHaveLength(1);
    expect(flag.rules[0].id).toBe('r1');
    expect(flag.tags).toEqual(['game', 'timer']);
  });

  it('rejects duplicate flag key', async () => {
    await createFlag(pid, { key: 'dup-flag', name: 'First', type: 'boolean', defaultValue: true });

    await expect(
      createFlag(pid, { key: 'dup-flag', name: 'Second', type: 'boolean', defaultValue: false }),
    ).rejects.toThrow('already exists');
  });

  it('rejects invalid flag key format', async () => {
    await expect(
      createFlag(pid, { key: 'UPPERCASE', name: 'Bad', type: 'boolean', defaultValue: true }),
    ).rejects.toThrow('Flag key must be');
  });

  // ── getFlag ─────────────────────────────────────────────────────────────

  it('returns null for non-existent flag', async () => {
    const flag = await getFlag(pid, 'does-not-exist');
    expect(flag).toBeNull();
  });

  // ── listFlags ───────────────────────────────────────────────────────────

  it('lists flags excluding soft-deleted ones', async () => {
    await createFlag(pid, { key: 'flag-aa', name: 'A', type: 'boolean', defaultValue: true });
    await createFlag(pid, { key: 'flag-bb', name: 'B', type: 'boolean', defaultValue: false });
    await createFlag(pid, { key: 'flag-cc', name: 'C', type: 'string', defaultValue: 'hello' });

    // Soft-delete one.
    await deleteFlag(pid, 'flag-bb');

    const flags = await listFlags(pid);
    expect(flags).toHaveLength(2);
    const keys = flags.map((f) => f.key);
    expect(keys).toContain('flag-aa');
    expect(keys).toContain('flag-cc');
    expect(keys).not.toContain('flag-bb');
  });

  // ── updateFlag ──────────────────────────────────────────────────────────

  it('updates flag fields', async () => {
    await createFlag(pid, {
      key: 'update-me',
      name: 'Original',
      type: 'boolean',
      defaultValue: true,
    });

    const updated = await updateFlag(pid, 'update-me', { name: 'Updated', enabled: false });
    expect(updated.name).toBe('Updated');
    expect(updated.enabled).toBe(false);
    expect(updated.defaultValue).toBe(true); // unchanged

    const fetched = await getFlag(pid, 'update-me');
    expect(fetched!.name).toBe('Updated');
    expect(fetched!.enabled).toBe(false);
  });

  it('rejects defaultValue type mismatch on update', async () => {
    await createFlag(pid, {
      key: 'typed-flag',
      name: 'Typed',
      type: 'boolean',
      defaultValue: true,
    });

    await expect(updateFlag(pid, 'typed-flag', { defaultValue: 'not-a-bool' })).rejects.toThrow(
      'defaultValue must be a boolean',
    );
  });

  it('accepts matching defaultValue type on update', async () => {
    await createFlag(pid, { key: 'num-flag', name: 'Num', type: 'number', defaultValue: 10 });

    const updated = await updateFlag(pid, 'num-flag', { defaultValue: 42 });
    expect(updated.defaultValue).toBe(42);
  });

  it('rejects update to non-existent flag', async () => {
    await expect(updateFlag(pid, 'ghost', { name: 'Nope' })).rejects.toThrow('not found');
  });

  it('rejects update to soft-deleted flag', async () => {
    await createFlag(pid, {
      key: 'deleted-flag',
      name: 'Soon gone',
      type: 'boolean',
      defaultValue: true,
    });
    await deleteFlag(pid, 'deleted-flag');

    await expect(updateFlag(pid, 'deleted-flag', { name: 'Revived' })).rejects.toThrow('not found');
  });

  // ── replaceFlag ─────────────────────────────────────────────────────────

  it('replaces a flag entirely', async () => {
    await createFlag(pid, {
      key: 'replace-me',
      name: 'V1',
      type: 'boolean',
      defaultValue: true,
      tags: ['old'],
    });

    const replaced = await replaceFlag(pid, 'replace-me', {
      key: 'replace-me',
      name: 'V2',
      type: 'string',
      defaultValue: 'new-val',
      tags: ['new'],
    });

    expect(replaced.name).toBe('V2');
    expect(replaced.type).toBe('string');
    expect(replaced.defaultValue).toBe('new-val');
    expect(replaced.tags).toEqual(['new']);
  });

  it('rejects replace on non-existent flag', async () => {
    await expect(
      replaceFlag(pid, 'no-such-flag', {
        key: 'no-such-flag',
        name: 'X',
        type: 'boolean',
        defaultValue: true,
      }),
    ).rejects.toThrow('not found');
  });

  // ── deleteFlag ──────────────────────────────────────────────────────────

  it('soft-deletes a flag (getFlag returns null)', async () => {
    await createFlag(pid, {
      key: 'soft-del',
      name: 'Delete Me',
      type: 'boolean',
      defaultValue: true,
    });

    await deleteFlag(pid, 'soft-del');

    const flag = await getFlag(pid, 'soft-del');
    expect(flag).toBeNull();
  });

  it('rejects delete on non-existent flag', async () => {
    await expect(deleteFlag(pid, 'nothing-here')).rejects.toThrow('not found');
  });
});
