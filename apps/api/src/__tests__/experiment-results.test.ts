import { describe, it, expect } from 'vitest';

/**
 * Test the statistical helpers from experiment-results.
 * normalCdf and welchTTest are not exported, so we replicate them here
 * and verify correctness against known values.
 */

// ── Replicated from experiment-results.ts ────────────────────────────────

function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

function welchTTest(
  n1: number,
  mean1: number,
  var1: number,
  n2: number,
  mean2: number,
  var2: number,
): number {
  if (n1 < 2 || n2 < 2) return 1;
  if (var1 === 0 && var2 === 0) return mean1 === mean2 ? 1 : 0;

  const se = Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) return 1;

  const t = (mean1 - mean2) / se;
  return 2 * (1 - normalCdf(Math.abs(t)));
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('normalCdf', () => {
  it('returns 0.5 at x=0', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
  });

  it('returns ~0.8413 at x=1 (one standard deviation)', () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413, 3);
  });

  it('returns ~0.1587 at x=-1', () => {
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 3);
  });

  it('returns ~0.9772 at x=2 (two standard deviations)', () => {
    expect(normalCdf(2)).toBeCloseTo(0.9772, 3);
  });

  it('approaches 1 for large positive x', () => {
    expect(normalCdf(5)).toBeGreaterThan(0.999);
  });

  it('approaches 0 for large negative x', () => {
    expect(normalCdf(-5)).toBeLessThan(0.001);
  });

  it('is symmetric: CDF(x) + CDF(-x) ≈ 1', () => {
    for (const x of [0.5, 1, 1.96, 2.5, 3]) {
      expect(normalCdf(x) + normalCdf(-x)).toBeCloseTo(1, 5);
    }
  });
});

describe('welchTTest', () => {
  it('returns 1 when sample size < 2', () => {
    expect(welchTTest(1, 0.5, 0.1, 100, 0.6, 0.1)).toBe(1);
    expect(welchTTest(100, 0.5, 0.1, 1, 0.6, 0.1)).toBe(1);
  });

  it('returns 1 when means are equal and variance is 0', () => {
    expect(welchTTest(50, 0.5, 0, 50, 0.5, 0)).toBe(1);
  });

  it('returns 0 when means differ and variance is 0', () => {
    expect(welchTTest(50, 0.3, 0, 50, 0.7, 0)).toBe(0);
  });

  it('returns small p-value for clearly different groups', () => {
    // Group A: n=100, mean=0.8, variance=0.01
    // Group B: n=100, mean=0.2, variance=0.01
    const p = welchTTest(100, 0.8, 0.01, 100, 0.2, 0.01);
    expect(p).toBeLessThan(0.001);
  });

  it('returns large p-value for similar groups', () => {
    // Group A: n=20, mean=0.50, variance=0.25
    // Group B: n=20, mean=0.51, variance=0.25
    const p = welchTTest(20, 0.5, 0.25, 20, 0.51, 0.25);
    expect(p).toBeGreaterThan(0.05);
  });

  it('detects significance at α=0.05 with sufficient sample', () => {
    // Conversion rates: 10% vs 15%, n=1000 each
    // Variance of Bernoulli = p*(1-p)
    const p = welchTTest(1000, 0.1, 0.09, 1000, 0.15, 0.1275);
    expect(p).toBeLessThan(0.05);
  });

  it('is symmetric in groups', () => {
    const p1 = welchTTest(50, 0.3, 0.1, 50, 0.6, 0.15);
    const p2 = welchTTest(50, 0.6, 0.15, 50, 0.3, 0.1);
    expect(p1).toBeCloseTo(p2, 10);
  });
});
