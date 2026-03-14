import { describe, it, expect } from 'vitest';
import { collectMetrics, metrics } from '../metrics';

// NOTE: The metrics singleton is shared across tests in this file.
// We test by observing cumulative output from collectMetrics().

describe('Counter', () => {
  it('increments and appears in collectMetrics output', () => {
    metrics.cacheHitsTotal.inc();
    metrics.cacheHitsTotal.inc();
    const output = collectMetrics();
    expect(output).toContain('# TYPE cache_hits_total counter');
    expect(output).toContain('cache_hits_total 2');
  });

  it('increments with labels', () => {
    metrics.flagEvaluationsTotal.inc({ flagKey: 'test-flag', reason: 'default' });
    metrics.flagEvaluationsTotal.inc({ flagKey: 'test-flag', reason: 'default' });
    metrics.flagEvaluationsTotal.inc({ flagKey: 'other-flag', reason: 'rule:r1' });
    const output = collectMetrics();
    expect(output).toContain('flag_evaluations_total{flagKey="test-flag",reason="default"} 2');
    expect(output).toContain('flag_evaluations_total{flagKey="other-flag",reason="rule:r1"} 1');
  });

  it('increments by a custom delta', () => {
    metrics.eventsIngestedTotal.inc({ status: 'accepted' }, 5);
    const output = collectMetrics();
    expect(output).toContain('events_ingested_total{status="accepted"} 5');
  });
});

describe('Gauge', () => {
  it('tracks set/inc/dec', () => {
    metrics.sseConnectionsActive.inc();
    metrics.sseConnectionsActive.inc();
    metrics.sseConnectionsActive.dec();
    const output = collectMetrics();
    expect(output).toContain('# TYPE sse_connections_active gauge');
    expect(output).toContain('sse_connections_active 1');
  });

  it('supports set with labels', () => {
    metrics.experimentSampleSize.set({ experimentId: 'exp-1', variant: 'control' }, 42);
    const output = collectMetrics();
    expect(output).toContain('experiment_sample_size{experimentId="exp-1",variant="control"} 42');
  });
});

describe('Histogram', () => {
  it('records observations with buckets, sum, and count', () => {
    metrics.flagEvaluationLatency.observe({ route: 'single' }, 2);
    metrics.flagEvaluationLatency.observe({ route: 'single' }, 8);
    const output = collectMetrics();

    // Both observations (2ms, 8ms) should be in the 10ms bucket
    expect(output).toContain('# TYPE flag_evaluation_latency_ms histogram');
    expect(output).toContain('flag_evaluation_latency_ms_sum{route="single"} 10');
    expect(output).toContain('flag_evaluation_latency_ms_count{route="single"} 2');

    // 2ms fits in the 2ms bucket, 8ms does not
    expect(output).toContain('flag_evaluation_latency_ms_bucket{route="single",le="2"} 1');
    // 10ms bucket should have both
    expect(output).toContain('flag_evaluation_latency_ms_bucket{route="single",le="10"} 2');
    // +Inf always equals count
    expect(output).toContain('flag_evaluation_latency_ms_bucket{route="single",le="+Inf"} 2');
  });
});

describe('collectMetrics', () => {
  it('returns HELP and TYPE lines for all registered metrics', () => {
    const output = collectMetrics();
    expect(output).toContain('# HELP flag_evaluations_total');
    expect(output).toContain('# HELP sse_connections_active');
    expect(output).toContain('# HELP http_requests_total');
    expect(output).toContain('# HELP cache_hits_total');
    expect(output).toContain('# HELP cache_misses_total');
  });

  it('ends with a newline', () => {
    const output = collectMetrics();
    expect(output.endsWith('\n')).toBe(true);
  });
});
