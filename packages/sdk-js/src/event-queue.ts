import type { HttpClient } from './http';
import type { TrackEvent } from './types';

/**
 * Buffers SDK events and flushes them in batches to the API.
 * Flushes when either the size threshold or the time interval is reached.
 * Drops oldest events when the queue exceeds MAX_QUEUE_SIZE to bound memory usage.
 */
const MAX_QUEUE_SIZE = 1_000;

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

  /** Enqueue an event. Triggers an immediate flush if the batch is full.
   * Drops the oldest event if the queue is at capacity. */
  push(event: TrackEvent): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift(); // drop oldest to bound memory
    }
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
      // Events are best-effort. Re-enqueue for retry but respect the cap.
      const available = MAX_QUEUE_SIZE - this.queue.length;
      if (available > 0) {
        this.queue.unshift(...batch.slice(0, available));
      }
    } finally {
      this.flushing = false;
    }
  }

  get pending(): number {
    return this.queue.length;
  }
}
