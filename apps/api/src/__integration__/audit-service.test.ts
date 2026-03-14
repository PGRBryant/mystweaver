import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock external dependencies that require Pub/Sub.
vi.mock('../services/pubsub-service', () => ({
  publishFlagChange: vi.fn().mockResolvedValue(undefined),
}));

import { writeAuditRecord, listAuditRecords } from '../services/audit-service';
import { createFlag } from '../services/flag-service';
import { createTestProjectId, cleanupProject } from './setup';

const pid = createTestProjectId('audit');

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST must be set to run integration tests');
  }
});

afterAll(async () => {
  await cleanupProject(pid);
});

describe('audit-service (integration)', () => {
  beforeEach(async () => {
    await cleanupProject(pid);
  });

  it('writes and reads back an audit record', async () => {
    await writeAuditRecord({
      projectId: pid,
      action: 'flag.created',
      performedBy: 'tester',
      flagKey: 'test-flag',
      after: { key: 'test-flag', name: 'Test' },
    });

    const records = await listAuditRecords({ projectId: pid });
    expect(records).toHaveLength(1);
    expect(records[0].action).toBe('flag.created');
    expect(records[0].flagKey).toBe('test-flag');
    expect(records[0].performedBy).toBe('tester');
    expect(records[0].after).toEqual({ key: 'test-flag', name: 'Test' });
  });

  it('filters audit records by flagKey', async () => {
    await writeAuditRecord({
      projectId: pid,
      action: 'flag.created',
      performedBy: 'a',
      flagKey: 'flag-1',
    });
    await writeAuditRecord({
      projectId: pid,
      action: 'flag.created',
      performedBy: 'a',
      flagKey: 'flag-2',
    });
    await writeAuditRecord({
      projectId: pid,
      action: 'flag.updated',
      performedBy: 'a',
      flagKey: 'flag-1',
    });

    const records = await listAuditRecords({ projectId: pid, flagKey: 'flag-1' });
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.flagKey === 'flag-1')).toBe(true);
  });

  it('filters audit records by action', async () => {
    await writeAuditRecord({
      projectId: pid,
      action: 'flag.created',
      performedBy: 'a',
      flagKey: 'flag-1',
    });
    await writeAuditRecord({
      projectId: pid,
      action: 'flag.deleted',
      performedBy: 'a',
      flagKey: 'flag-1',
    });
    await writeAuditRecord({
      projectId: pid,
      action: 'flag.created',
      performedBy: 'b',
      flagKey: 'flag-2',
    });

    const records = await listAuditRecords({ projectId: pid, action: 'flag.created' });
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.action === 'flag.created')).toBe(true);
  });

  it('filters audit records by performedBy', async () => {
    await writeAuditRecord({
      projectId: pid,
      action: 'flag.created',
      performedBy: 'alice',
      flagKey: 'f1',
    });
    await writeAuditRecord({
      projectId: pid,
      action: 'flag.created',
      performedBy: 'bob',
      flagKey: 'f2',
    });

    const records = await listAuditRecords({ projectId: pid, performedBy: 'alice' });
    expect(records).toHaveLength(1);
    expect(records[0].performedBy).toBe('alice');
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await writeAuditRecord({
        projectId: pid,
        action: 'flag.created',
        performedBy: 'a',
        flagKey: `f-${i}`,
      });
    }

    const records = await listAuditRecords({ projectId: pid, limit: 3 });
    expect(records).toHaveLength(3);
  });

  it('flag CRUD operations produce audit records via fire-and-forget', async () => {
    // createFlag calls writeAuditRecord as fire-and-forget (no await).
    await createFlag(pid, {
      key: 'audited-flag',
      name: 'Audited',
      type: 'boolean',
      defaultValue: true,
    });

    // Wait for the fire-and-forget audit write to settle.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const records = await listAuditRecords({ projectId: pid, flagKey: 'audited-flag' });
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records.some((r) => r.action === 'flag.created')).toBe(true);
  });
});
