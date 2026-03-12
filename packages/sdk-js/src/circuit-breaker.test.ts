import { describe, it, expect, vi, afterEach } from 'vitest';
import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in closed state and allows calls', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('closed');
    expect(cb.isAllowed).toBe(true);
  });

  it('stays closed after failures below threshold', () => {
    const cb = new CircuitBreaker({ threshold: 3 });
    cb.onFailure();
    cb.onFailure();
    expect(cb.getState()).toBe('closed');
    expect(cb.isAllowed).toBe(true);
  });

  it('opens after reaching failure threshold', () => {
    const cb = new CircuitBreaker({ threshold: 3 });
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();
    expect(cb.getState()).toBe('open');
    expect(cb.isAllowed).toBe(false);
  });

  it('resets to closed on success', () => {
    const cb = new CircuitBreaker({ threshold: 2 });
    cb.onFailure();
    cb.onFailure();
    expect(cb.getState()).toBe('open');

    // Simulate cooldown elapsed
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    expect(cb.isAllowed).toBe(true); // half-open
    expect(cb.getState()).toBe('half-open');

    cb.onSuccess();
    expect(cb.getState()).toBe('closed');
    expect(cb.isAllowed).toBe(true);
  });

  it('transitions to half-open after cooldown', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const cb = new CircuitBreaker({ threshold: 1, cooldown: 5_000 });
    cb.onFailure();
    expect(cb.getState()).toBe('open');
    expect(cb.isAllowed).toBe(false);

    // Not yet cooled down
    vi.spyOn(Date, 'now').mockReturnValue(now + 3_000);
    expect(cb.isAllowed).toBe(false);

    // Cooldown elapsed
    vi.spyOn(Date, 'now').mockReturnValue(now + 5_000);
    expect(cb.isAllowed).toBe(true);
    expect(cb.getState()).toBe('half-open');
  });

  it('re-opens on failure in half-open state', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const cb = new CircuitBreaker({ threshold: 1, cooldown: 1_000 });
    cb.onFailure();

    vi.spyOn(Date, 'now').mockReturnValue(now + 1_000);
    expect(cb.isAllowed).toBe(true); // half-open probe

    cb.onFailure(); // probe failed
    expect(cb.getState()).toBe('open');
  });

  it('uses default threshold of 3 and cooldown of 30s', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const cb = new CircuitBreaker();
    cb.onFailure();
    cb.onFailure();
    expect(cb.getState()).toBe('closed');
    cb.onFailure();
    expect(cb.getState()).toBe('open');

    // Not open after 29s
    vi.spyOn(Date, 'now').mockReturnValue(now + 29_000);
    expect(cb.isAllowed).toBe(false);

    // Open after 30s
    vi.spyOn(Date, 'now').mockReturnValue(now + 30_000);
    expect(cb.isAllowed).toBe(true);
  });

  it('resets failure count on success before threshold', () => {
    const cb = new CircuitBreaker({ threshold: 3 });
    cb.onFailure();
    cb.onFailure();
    cb.onSuccess(); // reset
    cb.onFailure();
    cb.onFailure();
    expect(cb.getState()).toBe('closed'); // still only 2 consecutive failures
  });
});
