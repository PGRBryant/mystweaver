import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventQueue } from './event-queue';
import type { HttpClient } from './http';
import type { TrackEvent } from './types';

function makeEvent(event = 'room.completed'): TrackEvent {
  return { type: 'metric.tracked', event, userId: 'u1', timestamp: 1 };
}

describe('EventQueue', () => {
  let http: { post: ReturnType<typeof vi.fn> };
  let queue: EventQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    http = { post: vi.fn().mockResolvedValue({ accepted: 1, dropped: 0 }) };
    queue = new EventQueue(http as unknown as HttpClient, 5000, 3);
  });

  afterEach(() => {
    queue.stop();
    vi.useRealTimers();
  });

  it('flushes when batch size is reached', async () => {
    queue.push(makeEvent());
    queue.push(makeEvent());
    queue.push(makeEvent()); // triggers flush at size 3

    // Let the microtask (void flush) resolve
    await vi.advanceTimersByTimeAsync(0);

    expect(http.post).toHaveBeenCalledOnce();
    expect(http.post.mock.calls[0][0]).toBe('/sdk/events');
    expect(http.post.mock.calls[0][1].events).toHaveLength(3);
    expect(queue.pending).toBe(0);
  });

  it('flushes on interval when started', async () => {
    queue.start();
    queue.push(makeEvent());

    expect(http.post).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);

    expect(http.post).toHaveBeenCalledOnce();
    expect(http.post.mock.calls[0][1].events).toHaveLength(1);
  });

  it('does not flush when queue is empty', async () => {
    await queue.flush();
    expect(http.post).not.toHaveBeenCalled();
  });

  it('re-enqueues events on flush failure', async () => {
    http.post.mockRejectedValueOnce(new Error('network error'));

    queue.push(makeEvent());
    queue.push(makeEvent());

    await queue.flush();

    expect(queue.pending).toBe(2); // re-enqueued
  });

  it('flush() resolves after POST completes', async () => {
    queue.push(makeEvent());
    await queue.flush();
    expect(http.post).toHaveBeenCalledOnce();
    expect(queue.pending).toBe(0);
  });

  it('stop() clears the interval timer', async () => {
    queue.start();
    queue.push(makeEvent());
    queue.stop();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(http.post).not.toHaveBeenCalled(); // timer was cleared
  });

  it('start() is idempotent', () => {
    queue.start();
    queue.start(); // should not create a second timer
    queue.push(makeEvent());
    queue.stop();
  });
});
