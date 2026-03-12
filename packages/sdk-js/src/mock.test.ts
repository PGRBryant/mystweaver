import { describe, it, expect, vi } from 'vitest';
import { MystweaverMockClient } from './mock';
import type { UserContext } from './types';

const CTX: UserContext = { id: 'user-1' };

describe('MystweaverMockClient', () => {
  // ── flag() ─────────────────────────────────────────────────────────────

  describe('flag()', () => {
    it('returns the boolean value from flags map', async () => {
      const client = new MystweaverMockClient({ flags: { f1: true, f2: false } });
      expect(await client.flag('f1', CTX)).toBe(true);
      expect(await client.flag('f2', CTX)).toBe(false);
    });

    it('returns false for missing flags', async () => {
      const client = new MystweaverMockClient();
      expect(await client.flag('missing', CTX)).toBe(false);
    });

    it('returns false for non-boolean values', async () => {
      const client = new MystweaverMockClient({ flags: { num: 42 } });
      expect(await client.flag('num', CTX)).toBe(false);
    });
  });

  // ── value() ────────────────────────────────────────────────────────────

  describe('value()', () => {
    it('returns the configured value', async () => {
      const client = new MystweaverMockClient({ flags: { timer: 5 } });
      expect(await client.value('timer', CTX, 8)).toBe(5);
    });

    it('returns defaultValue for missing flags', async () => {
      const client = new MystweaverMockClient();
      expect(await client.value('timer', CTX, 8)).toBe(8);
    });
  });

  // ── json() ─────────────────────────────────────────────────────────────

  describe('json()', () => {
    it('returns the object value', async () => {
      const obj = { a: 1, b: 2 };
      const client = new MystweaverMockClient({ flags: { config: obj } });
      expect(await client.json('config', CTX, {})).toEqual(obj);
    });

    it('returns default for non-object values', async () => {
      const client = new MystweaverMockClient({ flags: { config: 'string' } });
      const def = { fallback: true };
      expect(await client.json('config', CTX, def)).toBe(def);
    });
  });

  // ── evaluateAll() ──────────────────────────────────────────────────────

  describe('evaluateAll()', () => {
    it('returns values for known flags and null for unknown', async () => {
      const client = new MystweaverMockClient({ flags: { a: 1, b: true } });
      const result = await client.evaluateAll(['a', 'b', 'c'], CTX);
      expect(result).toEqual({ a: 1, b: true, c: null });
    });
  });

  // ── track() ────────────────────────────────────────────────────────────

  describe('track()', () => {
    it('captures events in trackedEvents', () => {
      const client = new MystweaverMockClient();
      client.track('room.completed', 'u1', { floor: 3 });
      client.track('powerup.used', 'u2');

      expect(client.trackedEvents).toHaveLength(2);
      expect(client.trackedEvents[0].event).toBe('room.completed');
      expect(client.trackedEvents[0].userId).toBe('u1');
      expect(client.trackedEvents[0].properties).toEqual({ floor: 3 });
      expect(client.trackedEvents[1].event).toBe('powerup.used');
    });
  });

  // ── override() ─────────────────────────────────────────────────────────

  describe('override()', () => {
    it('changes flag value at runtime', async () => {
      const client = new MystweaverMockClient({ flags: { timer: 8 } });
      expect(await client.value('timer', CTX, 0)).toBe(8);

      client.override('timer', 5);
      expect(await client.value('timer', CTX, 0)).toBe(5);
    });
  });

  // ── simulateFlagChange() ───────────────────────────────────────────────

  describe('simulateFlagChange()', () => {
    it('fires onFlagChange listeners with new and previous values', () => {
      const client = new MystweaverMockClient({ flags: { timer: 8 } });
      const listener = vi.fn();

      client.onFlagChange('timer', listener);
      client.simulateFlagChange('timer', 5);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(5, 8);
    });

    it('fires onEvent listeners', () => {
      const client = new MystweaverMockClient({ flags: { timer: 8 } });
      const listener = vi.fn();

      client.onEvent(listener);
      client.simulateFlagChange('timer', 5);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0].type).toBe('flag.updated');
      expect(listener.mock.calls[0][0].flagKey).toBe('timer');
      expect(listener.mock.calls[0][0].value).toBe(5);
      expect(listener.mock.calls[0][0].previousValue).toBe(8);
    });

    it('updates the stored flag value', async () => {
      const client = new MystweaverMockClient({ flags: { timer: 8 } });
      client.simulateFlagChange('timer', 5);
      expect(await client.value('timer', CTX, 0)).toBe(5);
    });

    it('does not error when no listeners are registered', () => {
      const client = new MystweaverMockClient({ flags: { timer: 8 } });
      expect(() => client.simulateFlagChange('timer', 5)).not.toThrow();
    });
  });

  // ── unsubscribe ────────────────────────────────────────────────────────

  describe('unsubscribe', () => {
    it('onFlagChange unsubscribe stops listener', () => {
      const client = new MystweaverMockClient({ flags: { timer: 8 } });
      const listener = vi.fn();

      const unsub = client.onFlagChange('timer', listener);
      unsub();
      client.simulateFlagChange('timer', 5);

      expect(listener).not.toHaveBeenCalled();
    });

    it('onEvent unsubscribe stops listener', () => {
      const client = new MystweaverMockClient();
      const listener = vi.fn();

      const unsub = client.onEvent(listener);
      unsub();
      client.simulateFlagChange('timer', 5);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── reset() ────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears flags and tracked events', async () => {
      const client = new MystweaverMockClient({ flags: { timer: 8 } });
      client.track('event', 'u1');

      client.reset({ timer: 99 });

      expect(await client.value('timer', CTX, 0)).toBe(99);
      expect(client.trackedEvents).toHaveLength(0);
    });

    it('resets to empty when called without args', async () => {
      const client = new MystweaverMockClient({ flags: { timer: 8 } });
      client.reset();
      expect(await client.value('timer', CTX, 0)).toBe(0);
    });
  });

  // ── lifecycle no-ops ───────────────────────────────────────────────────

  it('flush() and close() resolve without error', async () => {
    const client = new MystweaverMockClient();
    await expect(client.flush()).resolves.toBeUndefined();
    await expect(client.close()).resolves.toBeUndefined();
  });
});
