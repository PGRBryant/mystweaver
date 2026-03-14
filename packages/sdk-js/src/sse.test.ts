import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEManager } from './sse';

// ── Minimal EventSource stub ──────────────────────────────────────────────

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;
  closeCalled = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closeCalled = true;
  }

  /** Simulate receiving a message from the server. */
  simulateMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  /** Simulate a connection error / disconnect. */
  simulateError() {
    this.onerror?.();
  }
}

describe('SSEManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('connects to the stream URL with apiKey query param', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'my-key');
    mgr.connect();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('https://api.test.com/sdk/stream?apiKey=my-key');
    mgr.close();
  });

  it('dispatches flag.updated events to per-flag listeners', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();

    const listener = vi.fn();
    mgr.onFlagChange('game.timer', listener);

    const es = MockEventSource.instances[0];
    es.simulateMessage(
      JSON.stringify({
        type: 'flag.updated',
        flagKey: 'game.timer',
        value: 5,
        previousValue: 8,
        updatedAt: 1000,
      }),
    );

    expect(listener).toHaveBeenCalledWith(5, 8);
    mgr.close();
  });

  it('dispatches all events to global listeners', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();

    const listener = vi.fn();
    mgr.onEvent(listener);

    const es = MockEventSource.instances[0];
    es.simulateMessage(JSON.stringify({ type: 'ping' }));

    expect(listener).toHaveBeenCalledWith({ type: 'ping' });
    mgr.close();
  });

  it('unsubscribe removes the listener', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();

    const listener = vi.fn();
    const unsub = mgr.onFlagChange('flag-a', listener);
    unsub();

    const es = MockEventSource.instances[0];
    es.simulateMessage(
      JSON.stringify({ type: 'flag.updated', flagKey: 'flag-a', value: true, updatedAt: 1 }),
    );

    expect(listener).not.toHaveBeenCalled();
    mgr.close();
  });

  it('ignores malformed JSON messages', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();

    const listener = vi.fn();
    mgr.onEvent(listener);

    const es = MockEventSource.instances[0];
    es.simulateMessage('not valid json {{{');

    expect(listener).not.toHaveBeenCalled();
    mgr.close();
  });

  // ── Reconnect behavior ──────────────────────────────────────────────────

  it('reconnects after an error with initial 1s delay', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();
    expect(MockEventSource.instances).toHaveLength(1);

    // Simulate disconnect.
    MockEventSource.instances[0].simulateError();
    expect(MockEventSource.instances[0].closeCalled).toBe(true);

    // Not yet reconnected.
    expect(MockEventSource.instances).toHaveLength(1);

    // Advance 1s — should reconnect.
    vi.advanceTimersByTime(1_000);
    expect(MockEventSource.instances).toHaveLength(2);

    mgr.close();
  });

  it('uses exponential backoff on repeated failures (1s → 2s → 4s)', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();

    // First failure → 1s reconnect.
    MockEventSource.instances[0].simulateError();
    vi.advanceTimersByTime(1_000);
    expect(MockEventSource.instances).toHaveLength(2);

    // Second failure → 2s reconnect.
    MockEventSource.instances[1].simulateError();
    vi.advanceTimersByTime(1_999);
    expect(MockEventSource.instances).toHaveLength(2); // not yet
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(3);

    // Third failure → 4s reconnect.
    MockEventSource.instances[2].simulateError();
    vi.advanceTimersByTime(3_999);
    expect(MockEventSource.instances).toHaveLength(3); // not yet
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(4);

    mgr.close();
  });

  it('caps backoff at 30 seconds', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();

    // Simulate many failures to push backoff beyond 30s.
    // 1s → 2s → 4s → 8s → 16s → 32s (capped to 30s)
    for (let i = 0; i < 5; i++) {
      MockEventSource.instances[MockEventSource.instances.length - 1].simulateError();
      vi.advanceTimersByTime(60_000); // well beyond any backoff
    }

    // Now the backoff should be capped at 30s.
    const countBefore = MockEventSource.instances.length;
    MockEventSource.instances[MockEventSource.instances.length - 1].simulateError();

    vi.advanceTimersByTime(29_999);
    expect(MockEventSource.instances).toHaveLength(countBefore); // not yet
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(countBefore + 1);

    mgr.close();
  });

  it('resets backoff after receiving a message', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();

    // First failure → 1s reconnect.
    MockEventSource.instances[0].simulateError();
    vi.advanceTimersByTime(1_000);
    expect(MockEventSource.instances).toHaveLength(2);

    // Second failure → 2s reconnect.
    MockEventSource.instances[1].simulateError();
    vi.advanceTimersByTime(2_000);
    expect(MockEventSource.instances).toHaveLength(3);

    // Receive a message — should reset backoff.
    MockEventSource.instances[2].simulateMessage(JSON.stringify({ type: 'ping' }));

    // Now error again — should be back to 1s (not 4s).
    MockEventSource.instances[2].simulateError();
    vi.advanceTimersByTime(1_000);
    expect(MockEventSource.instances).toHaveLength(4);

    mgr.close();
  });

  it('reconnects within 5 seconds on first disconnect', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();

    MockEventSource.instances[0].simulateError();

    // After 5 seconds, should have reconnected (initial delay is 1s).
    vi.advanceTimersByTime(5_000);
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(2);

    mgr.close();
  });

  it('does not reconnect after close()', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();

    mgr.close();
    const countAfterClose = MockEventSource.instances.length;

    // Even after plenty of time, no new EventSource should be created.
    vi.advanceTimersByTime(60_000);
    expect(MockEventSource.instances).toHaveLength(countAfterClose);
  });

  it('connect is idempotent (does not open second connection)', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();
    mgr.connect();
    mgr.connect();
    expect(MockEventSource.instances).toHaveLength(1);
    mgr.close();
  });

  it('listeners survive reconnection', () => {
    const mgr = new SSEManager('https://api.test.com/sdk/stream', 'k');
    mgr.connect();

    const listener = vi.fn();
    mgr.onFlagChange('my-flag', listener);

    // Disconnect and reconnect.
    MockEventSource.instances[0].simulateError();
    vi.advanceTimersByTime(1_000);
    expect(MockEventSource.instances).toHaveLength(2);

    // Send event on the new connection.
    MockEventSource.instances[1].simulateMessage(
      JSON.stringify({ type: 'flag.updated', flagKey: 'my-flag', value: 42, updatedAt: 2 }),
    );

    expect(listener).toHaveBeenCalledWith(42, undefined);
    mgr.close();
  });
});
