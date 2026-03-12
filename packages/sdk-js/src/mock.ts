import type { UserContext, FlagChangeListener, SSEEvent, TrackEvent } from './types';

export interface MockClientConfig {
  /** Initial flag values. */
  flags?: Record<string, unknown>;
}

/**
 * Drop-in test replacement for {@link MystweaverClient}.
 * Evaluations return values from the in-memory `flags` map.
 * All tracked events are captured in `trackedEvents`.
 *
 * ```ts
 * import { MystweaverMockClient } from '@mystweaver/sdk/mock';
 *
 * const client = new MystweaverMockClient({
 *   flags: { 'game.task-timer-seconds': 8 },
 * });
 * ```
 */
export class MystweaverMockClient {
  private flags: Record<string, unknown>;
  private flagListeners = new Map<string, Set<FlagChangeListener>>();
  private eventListeners = new Set<(event: SSEEvent) => void>();

  /** All events passed to `track()`, in order. */
  readonly trackedEvents: TrackEvent[] = [];

  constructor(config: MockClientConfig = {}) {
    this.flags = { ...config.flags };
  }

  // ── Evaluation (synchronous under the hood, but matches async API) ─────

  async flag(flagKey: string, _context: UserContext): Promise<boolean> {
    const v = this.flags[flagKey];
    return typeof v === 'boolean' ? v : false;
  }

  async value<T = unknown>(flagKey: string, _context: UserContext, defaultValue: T): Promise<T> {
    const v = this.flags[flagKey];
    return (v ?? defaultValue) as T;
  }

  async json<T = Record<string, unknown>>(
    flagKey: string,
    _context: UserContext,
    defaultValue: T,
  ): Promise<T> {
    const v = this.flags[flagKey];
    if (v !== null && v !== undefined && typeof v === 'object') return v as T;
    return defaultValue;
  }

  async evaluateAll(flagKeys: string[], _context: UserContext): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const key of flagKeys) {
      out[key] = this.flags[key] ?? null;
    }
    return out;
  }

  // ── Event tracking ─────────────────────────────────────────────────────

  track(event: string, userId: string, properties?: Record<string, unknown>): void {
    this.trackedEvents.push({
      type: 'metric.tracked',
      event,
      userId,
      properties,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  // ── Real-time ──────────────────────────────────────────────────────────

  onFlagChange(flagKey: string, listener: FlagChangeListener): () => void {
    let set = this.flagListeners.get(flagKey);
    if (!set) {
      set = new Set();
      this.flagListeners.set(flagKey, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.flagListeners.delete(flagKey);
    };
  }

  onEvent(listener: (event: SSEEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  // ── Test helpers ───────────────────────────────────────────────────────

  /** Override a flag value at runtime. */
  override(flagKey: string, value: unknown): void {
    this.flags[flagKey] = value;
  }

  /** Simulate a flag change — fires all registered `onFlagChange` listeners. */
  simulateFlagChange(flagKey: string, newValue: unknown): void {
    const prev = this.flags[flagKey];
    this.flags[flagKey] = newValue;

    const set = this.flagListeners.get(flagKey);
    if (set) {
      for (const listener of set) {
        listener(newValue, prev);
      }
    }

    const event: SSEEvent = {
      type: 'flag.updated',
      flagKey,
      value: newValue,
      previousValue: prev,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  /** Reset all flag values and clear tracked events. */
  reset(flags?: Record<string, unknown>): void {
    this.flags = { ...flags };
    this.trackedEvents.length = 0;
  }

  // ── Lifecycle (no-ops for mock) ────────────────────────────────────────

  async flush(): Promise<void> {}
  async close(): Promise<void> {}
}
