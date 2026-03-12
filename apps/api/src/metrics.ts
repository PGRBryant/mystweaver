/**
 * Lightweight in-process metrics registry.
 * Exposes Prometheus text format via GET /metrics.
 */

// ── Counter ──────────────────────────────────────────────────────────────────

class Counter {
  private counts = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
  ) {}

  inc(labels: Record<string, string> = {}, delta = 1): void {
    const key = labelKey(labels);
    this.counts.set(key, (this.counts.get(key) ?? 0) + delta);
  }

  collect(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const [key, value] of this.counts) {
      lines.push(`${this.name}${key} ${value}`);
    }
    return lines.join('\n');
  }
}

// ── Gauge ────────────────────────────────────────────────────────────────────

class Gauge {
  private values = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
  ) {}

  set(labels: Record<string, string>, value: number): void {
    this.values.set(labelKey(labels), value);
  }

  inc(labels: Record<string, string> = {}, delta = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + delta);
  }

  dec(labels: Record<string, string> = {}, delta = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) - delta);
  }

  collect(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const [key, value] of this.values) {
      lines.push(`${this.name}${key} ${value}`);
    }
    return lines.join('\n');
  }
}

// ── Histogram ────────────────────────────────────────────────────────────────

class Histogram {
  private sums = new Map<string, number>();
  private counts = new Map<string, number>();
  private bucketCounts = new Map<string, Map<number, number>>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly buckets: number[] = [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  ) {}

  observe(labels: Record<string, string>, value: number): void {
    const key = labelKey(labels);
    this.sums.set(key, (this.sums.get(key) ?? 0) + value);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);

    if (!this.bucketCounts.has(key)) {
      this.bucketCounts.set(key, new Map());
    }
    const bc = this.bucketCounts.get(key)!;
    for (const b of this.buckets) {
      if (value <= b) {
        bc.set(b, (bc.get(b) ?? 0) + 1);
        break; // Only increment the smallest matching bucket; collect() cumulates.
      }
    }
  }

  collect(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const [key, sum] of this.sums) {
      const count = this.counts.get(key) ?? 0;
      const bc = this.bucketCounts.get(key) ?? new Map();
      let cumulative = 0;
      for (const b of this.buckets) {
        cumulative += bc.get(b) ?? 0;
        lines.push(`${this.name}_bucket${mergeLabelKey(key, 'le', String(b))} ${cumulative}`);
      }
      lines.push(`${this.name}_bucket${mergeLabelKey(key, 'le', '+Inf')} ${count}`);
      lines.push(`${this.name}_sum${key} ${sum}`);
      lines.push(`${this.name}_count${key} ${count}`);
    }
    return lines.join('\n');
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function labelKey(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return '{' + entries.map(([k, v]) => `${k}="${v}"`).join(',') + '}';
}

function mergeLabelKey(existing: string, extraKey: string, extraValue: string): string {
  const extra = `${extraKey}="${extraValue}"`;
  if (!existing) return `{${extra}}`;
  return existing.slice(0, -1) + ',' + extra + '}';
}

// ── Registry ─────────────────────────────────────────────────────────────────

const registry: Array<Counter | Gauge | Histogram> = [];

function counter(name: string, help: string): Counter {
  const c = new Counter(name, help);
  registry.push(c);
  return c;
}

function gauge(name: string, help: string): Gauge {
  const g = new Gauge(name, help);
  registry.push(g);
  return g;
}

function histogram(name: string, help: string, buckets?: number[]): Histogram {
  const h = new Histogram(name, help, buckets);
  registry.push(h);
  return h;
}

export function collectMetrics(): string {
  return registry.map((m) => m.collect()).join('\n\n') + '\n';
}

// ── Application metrics ──────────────────────────────────────────────────────

export const metrics = {
  // Flag evaluation
  flagEvaluationsTotal: counter('flag_evaluations_total', 'Total flag evaluations'),
  flagEvaluationLatency: histogram(
    'flag_evaluation_latency_ms',
    'Flag evaluation latency in milliseconds',
    [0.5, 1, 2, 5, 10, 25, 50, 100],
  ),

  // SSE
  sseConnectionsActive: gauge('sse_connections_active', 'Currently active SSE connections'),
  sseConnectionsTotal: counter('sse_connections_total', 'Total SSE connections opened'),

  // Events
  eventsIngestedTotal: counter('events_ingested_total', 'Total events ingested'),

  // Experiment
  experimentSampleSize: gauge('experiment_sample_size', 'Current experiment sample size'),

  // HTTP
  httpRequestsTotal: counter('http_requests_total', 'Total HTTP requests'),
  httpRequestLatency: histogram(
    'http_request_latency_ms',
    'HTTP request latency in milliseconds',
    [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  ),
  httpErrorsTotal: counter('http_errors_total', 'Total HTTP errors'),

  // Cache
  cacheHitsTotal: counter('cache_hits_total', 'Cache hits'),
  cacheMissesTotal: counter('cache_misses_total', 'Cache misses'),
};
