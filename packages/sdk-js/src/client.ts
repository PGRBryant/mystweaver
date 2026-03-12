import { HttpClient } from './http';
import { CircuitBreaker } from './circuit-breaker';
import { EventQueue } from './event-queue';
import { SSEManager } from './sse';
import type {
  MystweaverConfig,
  UserContext,
  EvaluationResult,
  BulkEvaluationResult,
  FlagChangeListener,
  SSEEvent,
} from './types';

const DEFAULT_TIMEOUT = 5_000;
const DEFAULT_FLUSH_INTERVAL = 5_000;
const DEFAULT_FLUSH_SIZE = 20;

export class MystweaverClient {
  private readonly http: HttpClient;
  private readonly breaker: CircuitBreaker;
  private readonly events: EventQueue;
  private readonly sse: SSEManager | null;
  private readonly defaults: Record<string, unknown>;
  private closed = false;

  constructor(config: MystweaverConfig) {
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    this.http = new HttpClient(baseUrl, config.apiKey, timeout);
    this.breaker = new CircuitBreaker();
    this.defaults = config.defaults ?? {};

    this.events = new EventQueue(
      this.http,
      config.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
      config.flushSize ?? DEFAULT_FLUSH_SIZE,
    );
    this.events.start();

    if (config.streaming) {
      this.sse = new SSEManager(`${baseUrl}/sdk/stream`, config.apiKey);
      this.sse.connect();
    } else {
      this.sse = null;
    }
  }

  // ── Evaluation methods ─────────────────────────────────────────────────

  /**
   * Evaluate a boolean feature flag.
   * Returns `false` (or the configured default) if the flag is unknown or
   * the API is unreachable.
   */
  async flag(flagKey: string, context: UserContext): Promise<boolean> {
    const result = await this.evaluate(flagKey, context);
    return typeof result === 'boolean' ? result : Boolean(this.defaults[flagKey] ?? false);
  }

  /**
   * Evaluate a flag and return its typed value.
   * Falls back to `defaultValue` on error or if the API is unreachable.
   */
  async value<T = unknown>(flagKey: string, context: UserContext, defaultValue: T): Promise<T> {
    const result = await this.evaluate(flagKey, context);
    return (result ?? defaultValue) as T;
  }

  /**
   * Evaluate a JSON flag.
   * Falls back to `defaultValue` on error or if the API is unreachable.
   */
  async json<T = Record<string, unknown>>(
    flagKey: string,
    context: UserContext,
    defaultValue: T,
  ): Promise<T> {
    const result = await this.evaluate(flagKey, context);
    if (result !== null && typeof result === 'object') return result as T;
    return defaultValue;
  }

  /**
   * Bulk-evaluate multiple flags in a single request.
   * Returns a record of flag key → value.  Unknown flags have `null` values.
   */
  async evaluateAll(flagKeys: string[], context: UserContext): Promise<Record<string, unknown>> {
    if (!this.breaker.isAllowed) {
      return this.bulkDefaults(flagKeys);
    }

    try {
      const result = await this.http.post<BulkEvaluationResult>('/sdk/evaluate/bulk', {
        flags: flagKeys,
        userContext: context,
      });
      this.breaker.onSuccess();

      const out: Record<string, unknown> = {};
      for (const key of flagKeys) {
        out[key] = result.flags[key]?.value ?? this.defaults[key] ?? null;
      }
      return out;
    } catch {
      this.breaker.onFailure();
      return this.bulkDefaults(flagKeys);
    }
  }

  // ── Event tracking ─────────────────────────────────────────────────────

  /**
   * Track a metric event (e.g. "room.completed").
   * Events are batched and flushed periodically.
   */
  track(event: string, userId: string, properties?: Record<string, unknown>): void {
    this.events.push({
      type: 'metric.tracked',
      event,
      userId,
      properties,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  // ── Real-time updates ──────────────────────────────────────────────────

  /**
   * Register a callback that fires whenever a specific flag changes via SSE.
   * Returns an unsubscribe function.
   * Requires `streaming: true` in the client config.
   */
  onFlagChange(flagKey: string, listener: FlagChangeListener): () => void {
    if (!this.sse) {
      return () => {};
    }
    return this.sse.onFlagChange(flagKey, listener);
  }

  /**
   * Register a callback for all SSE events.
   * Returns an unsubscribe function.
   */
  onEvent(listener: (event: SSEEvent) => void): () => void {
    if (!this.sse) {
      return () => {};
    }
    return this.sse.onEvent(listener);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /** Flush all pending events to the API. */
  async flush(): Promise<void> {
    await this.events.flush();
  }

  /** Flush events, close the SSE connection, and release all resources. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.events.stop();
    await this.events.flush();
    this.sse?.close();
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async evaluate(flagKey: string, context: UserContext): Promise<unknown> {
    if (!this.breaker.isAllowed) {
      return this.defaults[flagKey] ?? null;
    }

    try {
      const result = await this.http.post<EvaluationResult>('/sdk/evaluate', {
        flagKey,
        userContext: context,
      });
      this.breaker.onSuccess();
      return result.value;
    } catch {
      this.breaker.onFailure();
      return this.defaults[flagKey] ?? null;
    }
  }

  private bulkDefaults(flagKeys: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of flagKeys) {
      out[key] = this.defaults[key] ?? null;
    }
    return out;
  }
}
