/* global EventSource */
import type { SSEEvent, FlagChangeListener } from './types';

/**
 * Manages a Server-Sent Events connection to the Mystweaver streaming
 * endpoint.  Automatically reconnects with exponential backoff on
 * disconnect and dispatches parsed events to registered listeners.
 *
 * Uses the native EventSource API (available in browsers and Node ≥ 18
 * with the --experimental-fetch flag, or via a polyfill).
 *
 * NOTE: The standard EventSource API does not support custom headers, so
 * the API key is passed as a query parameter.  The Mystweaver stream
 * endpoint must accept `?apiKey=<key>` as an alternative to the
 * Authorization header.  If EventSource is unavailable (e.g. older Node
 * without a polyfill) the manager silently no-ops.
 */

const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

export class SSEManager {
  private es: EventSource | null = null;
  private listeners = new Map<string, Set<FlagChangeListener>>();
  private globalListeners = new Set<(event: SSEEvent) => void>();
  private reconnectMs = BASE_RECONNECT_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  /** Open the SSE connection (idempotent). */
  connect(): void {
    if (this.closed || this.es) return;
    if (typeof EventSource === 'undefined') return; // no runtime support

    const separator = this.url.includes('?') ? '&' : '?';
    this.es = new EventSource(`${this.url}${separator}apiKey=${encodeURIComponent(this.apiKey)}`);

    this.es.onmessage = (msg) => {
      this.reconnectMs = BASE_RECONNECT_MS; // reset backoff on any message
      try {
        const event: SSEEvent = JSON.parse(msg.data);
        this.dispatch(event);
      } catch {
        // Ignore malformed messages.
      }
    };

    this.es.onerror = () => {
      this.cleanup();
      this.scheduleReconnect();
    };
  }

  /** Register a listener for a specific flag key. */
  onFlagChange(flagKey: string, listener: FlagChangeListener): () => void {
    let set = this.listeners.get(flagKey);
    if (!set) {
      set = new Set();
      this.listeners.set(flagKey, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.listeners.delete(flagKey);
    };
  }

  /** Register a listener for all SSE events. */
  onEvent(listener: (event: SSEEvent) => void): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /** Close the connection permanently. */
  close(): void {
    this.closed = true;
    this.cleanup();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ── internals ──────────────────────────────────────────────────────────

  private dispatch(event: SSEEvent): void {
    for (const listener of this.globalListeners) {
      listener(event);
    }

    if (event.type === 'flag.updated') {
      const set = this.listeners.get(event.flagKey);
      if (set) {
        for (const listener of set) {
          listener(event.value, event.previousValue);
        }
      }
    }
  }

  private cleanup(): void {
    if (this.es) {
      this.es.onmessage = null as unknown as EventSource['onmessage'];
      this.es.onerror = null as unknown as EventSource['onerror'];
      this.es.close();
      this.es = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectMs);
    this.reconnectMs = Math.min(this.reconnectMs * 2, MAX_RECONNECT_MS);
  }
}
