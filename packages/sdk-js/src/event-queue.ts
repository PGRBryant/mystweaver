import type { HttpClient } from './http';
import type { TrackEvent } from './types';

/**
 * Buffers SDK events and flushes them in batches to the API.
 * Flushes when either the size threshold or the time interval is reached.
 */
export class EventQueue {
  private queue: TrackEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(
    private readonly http: HttpClient,
    private readonly flushInterval: number,
    private readonly flushSize: number,
  ) {}

  /** Start the periodic flush timer. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushInterval);
  }

  /** Stop the periodic flush timer. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Enqueue an event. Triggers an immediate flush if the batch is full. */
  push(event: TrackEvent): void {
    this.queue.push(event);
    if (this.queue.length >= this.flushSize) {
      void this.flush();
    }
  }

  /** Flush all queued events to the API. Resolves when the POST completes. */
  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;

    // Drain the current queue.
    const batch = this.queue.splice(0);

    try {
      await this.http.post('/sdk/events', { events: batch });
    } catch {
      // Fire-and-forget — events are best-effort.
      // Re-enqueue on failure so they can be retried on next flush.
      this.queue.unshift(...batch);
    } finally {
      this.flushing = false;
    }
  }

  get pending(): number {
    return this.queue.length;
  }
}
