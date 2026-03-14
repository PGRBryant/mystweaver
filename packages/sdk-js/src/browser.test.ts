// @vitest-environment jsdom
/**
 * Browser-environment tests.
 *
 * These run in jsdom to verify the SDK works in a browser-like context
 * where `window`, `document`, and `EventSource` may be present.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MystweaverClient } from './client';
import { MystweaverMockClient } from './mock';
import type { UserContext, EvaluationResult, BulkEvaluationResult } from './types';

const CTX: UserContext = { id: 'browser-user', attributes: { platform: 'web' } };

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

describe('SDK in browser environment (jsdom)', () => {
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
      flushInterval: 60_000,
      flushSize: 100,
    });
  }

  // ── Verify jsdom environment ────────────────────────────────────────────

  it('runs in a browser-like environment', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });

  // ── Flag evaluation ─────────────────────────────────────────────────────

  it('flag() works in browser env', async () => {
    mockFetch(evalResult(true));
    const client = makeClient();
    const result = await client.flag('feature-x', CTX);
    expect(result).toBe(true);
    await client.close();
  });

  it('value() works in browser env', async () => {
    mockFetch(evalResult(42, 'number'));
    const client = makeClient();
    const result = await client.value('timer', CTX, 8);
    expect(result).toBe(42);
    await client.close();
  });

  it('json() works in browser env', async () => {
    const obj = { theme: 'dark' };
    mockFetch(evalResult(obj, 'json'));
    const client = makeClient();
    const result = await client.json('config', CTX, {});
    expect(result).toEqual(obj);
    await client.close();
  });

  it('evaluateAll() works in browser env', async () => {
    mockFetch(bulkResult({ 'flag-a': true, 'flag-b': 'on' }));
    const client = makeClient();
    const result = await client.evaluateAll(['flag-a', 'flag-b'], CTX);
    expect(result['flag-a']).toBe(true);
    expect(result['flag-b']).toBe('on');
    await client.close();
  });

  // ── Event tracking ──────────────────────────────────────────────────────

  it('track() and flush() work in browser env', async () => {
    mockFetch({ accepted: 1, dropped: 0 });
    const client = makeClient();
    client.track('page.view', 'user-1', { page: '/home' });
    await client.flush();

    const eventsCalls = fetchMock.mock.calls.filter((c: [string]) => c[0].includes('/sdk/events'));
    expect(eventsCalls).toHaveLength(1);
    await client.close();
  });

  // ── Circuit breaker ─────────────────────────────────────────────────────

  it('circuit breaker returns defaults in browser env', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));
    const client = makeClient({ 'feature-x': true });

    // Trip the breaker (3 failures).
    await client.flag('feature-x', CTX);
    await client.flag('feature-x', CTX);
    await client.flag('feature-x', CTX);

    fetchMock.mockClear();
    const result = await client.flag('feature-x', CTX);
    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    await client.close();
  });

  // ── Mock client in browser ──────────────────────────────────────────────

  it('MystweaverMockClient works in browser env', async () => {
    const mock = new MystweaverMockClient({ flags: { 'dark-mode': true } });
    const result = await mock.flag('dark-mode');
    expect(result).toBe(true);

    mock.override('dark-mode', false);
    const result2 = await mock.flag('dark-mode');
    expect(result2).toBe(false);

    mock.close();
  });

  it('mock simulateFlagChange fires listeners in browser env', async () => {
    const mock = new MystweaverMockClient({ flags: { timer: 8 } });
    const listener = vi.fn();
    mock.onFlagChange('timer', listener);

    mock.simulateFlagChange('timer', 5);
    expect(listener).toHaveBeenCalledWith(5, 8);

    mock.close();
  });
});
