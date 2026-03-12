/**
 * Simple circuit breaker that tracks consecutive failures and opens the
 * circuit when a threshold is reached.  While open, calls are rejected
 * immediately (the caller should fall back to defaults).  After a cooldown
 * period the circuit moves to half-open and allows a single probe request.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening (default: 3) */
  threshold?: number;
  /** Time in ms before moving from open → half-open (default: 30 000) */
  cooldown?: number;
}

export class CircuitBreaker {
  private failures = 0;
  private state: CircuitState = 'closed';
  private nextAttemptAt = 0;

  private readonly threshold: number;
  private readonly cooldown: number;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.threshold = opts.threshold ?? 3;
    this.cooldown = opts.cooldown ?? 30_000;
  }

  /** Returns true when calls should be allowed through. */
  get isAllowed(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open' && Date.now() >= this.nextAttemptAt) {
      this.state = 'half-open';
      return true;
    }
    return this.state === 'half-open';
  }

  /** Record a successful call — resets state to closed. */
  onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  /** Record a failed call — may open the circuit. */
  onFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'open';
      this.nextAttemptAt = Date.now() + this.cooldown;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
