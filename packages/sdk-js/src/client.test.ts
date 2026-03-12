import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MystweaverClient } from './client';
import type { UserContext, EvaluationResult, BulkEvaluationResult } from './types';

const CTX: UserContext = { id: 'user-1', attributes: { tier: 'gold' } };

function evalResult(value: unknown, type = 'boolean'): EvaluationResult {
  return {
    flagKey: 'test-flag',
    value,
    type,
    reason: 'default',
    enabled: true,
    evaluatedAt: 1,
  };
}

function bulkResult(flags: Record<string, unknown>): BulkEvaluationResult {
  const mapped: BulkEvaluationResult['flags'] = {};
  for (const [k, v] of Object.entries(flags)) {
    mapped[k] = { value: v, reason: 'default', enabled: true };
  }
  return { flags: mapped, evaluatedAt: 1, durationMs: 2 };
}

describe('MystweaverClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mockFetch(body: unknown, status = 200) {
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  function makeClient(defaults?: Record<string, unknown>) {
    return new MystweaverClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
      defaults,
      timeout: 1000,
      flushInterval: 60_000, // long so it doesn't auto-flush during tests
      flushSize: 100,
    });
  }

  // ── flag() ─────────────────────────────────────────────────────────────

  describe('flag()', () => {
    it('returns true when API returns boolean true', async () => {
      mockFetch(evalResult(true));
      const client = makeClient();
      const result = await client.flag('feature-x', CTX);
      expect(result).toBe(true);
      await client.close();
    });

    it('returns false when API returns boolean false', async () => {
      mockFetch(evalResult(false));
      const client = makeClient();
      const result = await client.flag('feature-x', CTX);
      expect(result).toBe(false);
      await client.close();
    });

    it('returns false when flag value is not a boolean', async () => {
      mockFetch(evalResult(42, 'number'));
      const client = makeClient();
      const result = await client.flag('feature-x', CTX);
      expect(result).toBe(false);
      await client.close();
    });

    it('returns configured default when flag value is non-boolean', async () => {
      mockFetch(evalResult('not-a-bool', 'string'));
      const client = makeClient({ 'feature-x': true });
      const result = await client.flag('feature-x', CTX);
      expect(result).toBe(true);
      await client.close();
    });
  });

  // ── value() ────────────────────────────────────────────────────────────

  describe('value()', () => {
    it('returns the API value', async () => {
      mockFetch(evalResult(42, 'number'));
      const client = makeClient();
      const result = await client.value('timer', CTX, 8);
      expect(result).toBe(42);
      await client.close();
    });

    it('returns defaultValue when API returns null', async () => {
      mockFetch(evalResult(null));
      const client = makeClient();
      const result = await client.value('timer', CTX, 8);
      expect(result).toBe(8);
      await client.close();
    });
  });

  // ── json() ─────────────────────────────────────────────────────────────

  describe('json()', () => {
    it('returns parsed JSON object', async () => {
      const obj = { legendary: 0.05, epic: 0.15 };
      mockFetch(evalResult(obj, 'json'));
      const client = makeClient();
      const result = await client.json('tier-weights', CTX, {});
      expect(result).toEqual(obj);
      await client.close();
    });

    it('returns default when value is not an object', async () => {
      mockFetch(evalResult('not-json', 'string'));
      const client = makeClient();
      const fallback = { default: true };
      const result = await client.json('tier-weights', CTX, fallback);
      expect(result).toBe(fallback);
      await client.close();
    });
  });

  // ── evaluateAll() ──────────────────────────────────────────────────────

  describe('evaluateAll()', () => {
    it('returns all flag values from bulk endpoint', async () => {
      mockFetch(bulkResult({ 'flag-a': true, 'flag-b': 5 }));
      const client = makeClient();
      const result = await client.evaluateAll(['flag-a', 'flag-b'], CTX);
      expect(result).toEqual({ 'flag-a': true, 'flag-b': 5 });
      await client.close();
    });

    it('returns null for unknown flags', async () => {
      mockFetch(bulkResult({ 'flag-a': true }));
      const client = makeClient();
      const result = await client.evaluateAll(['flag-a', 'flag-missing'], CTX);
      expect(result['flag-a']).toBe(true);
      expect(result['flag-missing']).toBeNull();
      await client.close();
    });

    it('returns defaults for unknown flags when configured', async () => {
      mockFetch(bulkResult({ 'flag-a': true }));
      const client = makeClient({ 'flag-missing': 99 });
      const result = await client.evaluateAll(['flag-a', 'flag-missing'], CTX);
      expect(result['flag-missing']).toBe(99);
      await client.close();
    });
  });

  // ── track() ────────────────────────────────────────────────────────────

  describe('track()', () => {
    it('batches events and sends on flush()', async () => {
      mockFetch({ accepted: 2, dropped: 0 });
      const client = makeClient();

      client.track('room.completed', 'user-1', { floor: 7 });
      client.track('powerup.used', 'user-1');

      await client.flush();

      // The flush call should POST to /sdk/events
      const eventsCalls = fetchMock.mock.calls.filter((c: [string]) =>
        c[0].includes('/sdk/events'),
      );
      expect(eventsCalls).toHaveLength(1);

      const body = JSON.parse(eventsCalls[0][1].body);
      expect(body.events).toHaveLength(2);
      expect(body.events[0].event).toBe('room.completed');
      expect(body.events[0].userId).toBe('user-1');
      expect(body.events[1].event).toBe('powerup.used');

      await client.close();
    });
  });

  // ── Circuit breaker fallback ───────────────────────────────────────────

  describe('circuit breaker', () => {
    it('returns defaults when API is down (after threshold failures)', async () => {
      fetchMock.mockRejectedValue(new Error('network error'));
      const client = makeClient({ 'feature-x': true });

      // 3 failures to trip the breaker
      await client.flag('feature-x', CTX);
      await client.flag('feature-x', CTX);
      await client.flag('feature-x', CTX);

      // Now the circuit is open — should return default without calling fetch
      fetchMock.mockClear();
      const result = await client.flag('feature-x', CTX);
      expect(result).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();

      await client.close();
    });

    it('returns null when API is down and no default configured', async () => {
      fetchMock.mockRejectedValue(new Error('network error'));
      const client = makeClient();

      const r1 = await client.flag('no-default', CTX);
      expect(r1).toBe(false); // flag() returns false for null

      const r2 = await client.value('no-default', CTX, 42);
      expect(r2).toBe(42); // value() uses provided default

      await client.close();
    });

    it('evaluateAll returns defaults when circuit is open', async () => {
      fetchMock.mockRejectedValue(new Error('down'));
      const client = makeClient({ a: 1, b: 2 });

      // Trip breaker
      await client.evaluateAll(['a'], CTX);
      await client.evaluateAll(['a'], CTX);
      await client.evaluateAll(['a'], CTX);

      fetchMock.mockClear();
      const result = await client.evaluateAll(['a', 'b', 'c'], CTX);
      expect(result).toEqual({ a: 1, b: 2, c: null });
      expect(fetchMock).not.toHaveBeenCalled();

      await client.close();
    });
  });

  // ── close() ────────────────────────────────────────────────────────────

  describe('close()', () => {
    it('flushes pending events on close', async () => {
      mockFetch({ accepted: 1, dropped: 0 });
      const client = makeClient();
      client.track('room.completed', 'user-1');
      await client.close();

      const eventsCalls = fetchMock.mock.calls.filter((c: [string]) =>
        c[0].includes('/sdk/events'),
      );
      expect(eventsCalls).toHaveLength(1);
    });

    it('is idempotent', async () => {
      mockFetch({ accepted: 0, dropped: 0 });
      const client = makeClient();
      await client.close();
      await client.close(); // no error
    });
  });
});
