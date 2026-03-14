// ── Verika identity integration ───────────────────────────────────────────
//
// TODO(verika): Replace this stub interface with the real one from @internal/verika:
//   import type { VerikaClient } from '@internal/verika';
//
// The stub is intentionally minimal — only getToken() is required for Phase 0.
// When Verika is deployed, the real VerikaClient will be a superset of this.

/** Minimal Verika client interface required by MystweaverClient (Phase 0 stub). */
export interface VerikaClient {
  /**
   * Returns a short-lived bearer token for authenticating requests to Mystweaver.
   * Called per-request; the implementation is responsible for caching/refreshing.
   *
   * TODO(verika): Will be implemented by @internal/verika once the service is live.
   */
  getToken(): Promise<string>;
}

// ── Configuration ────────────────────────────────────────────────────────

export interface MystweaverConfig {
  /**
   * SDK API key (e.g. "mw_sdk_live_...").
   * Required unless `identity` is provided — when both are present, `identity`
   * takes precedence and `apiKey` is used as a fallback if getToken() fails.
   */
  apiKey?: string;
  /** Base URL of the Mystweaver API (e.g. "https://api.mystweaver.dev") */
  baseUrl: string;
  /**
   * Verika identity client for service-to-service authentication.
   * When provided, the SDK obtains bearer tokens from Verika instead of using
   * the raw `apiKey`. Falls back to `apiKey` if getToken() throws or returns empty.
   *
   * TODO(verika): Pass a real VerikaClient here once @internal/verika is published.
   * Example:
   *   import { createVerikaClient } from '@internal/verika';
   *   const verika = createVerikaClient({ endpoint: process.env.VERIKA_ENDPOINT, serviceId: process.env.VERIKA_SERVICE_ID });
   *   const client = new MystweaverClient({ baseUrl, identity: verika });
   */
  identity?: VerikaClient;
  /** Fallback values returned when the API is unreachable */
  defaults?: Record<string, unknown>;
  /** Enable Server-Sent Events for real-time flag updates (default: false) */
  streaming?: boolean;
  /** Event batch flush interval in ms (default: 5000) */
  flushInterval?: number;
  /** Maximum events per batch before auto-flush (default: 20) */
  flushSize?: number;
  /** Request timeout in ms (default: 5000) */
  timeout?: number;
}

// ── User context ─────────────────────────────────────────────────────────

export interface UserContext {
  id: string;
  attributes?: Record<string, unknown>;
}

// ── Evaluation ───────────────────────────────────────────────────────────

export interface EvaluationResult {
  flagKey: string;
  value: unknown;
  type: string;
  reason: string;
  ruleId?: string;
  enabled: boolean;
  evaluatedAt: number;
}

export interface BulkEvaluationResult {
  flags: Record<string, { value: unknown; reason: string; enabled: boolean }>;
  evaluatedAt: number;
  durationMs: number;
}

// ── Events ───────────────────────────────────────────────────────────────

export interface TrackEvent {
  type: string;
  flagKey?: string;
  event?: string;
  userId?: string;
  value?: unknown;
  properties?: Record<string, unknown>;
  timestamp: number;
}

export interface EventIngestionResponse {
  accepted: number;
  dropped: number;
}

// ── SSE ──────────────────────────────────────────────────────────────────

export interface SSESnapshotEvent {
  type: 'snapshot';
  flags: Record<string, { value: unknown; type: string; enabled: boolean }>;
}

export interface SSEFlagUpdatedEvent {
  type: 'flag.updated';
  flagKey: string;
  value: unknown;
  previousValue?: unknown;
  updatedAt: number;
}

export interface SSEPingEvent {
  type: 'ping';
}

export type SSEEvent = SSESnapshotEvent | SSEFlagUpdatedEvent | SSEPingEvent;

// ── Flag config (for local evaluation) ───────────────────────────────────

export interface FlagCondition {
  attribute: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface FlagRule {
  id: string;
  description?: string;
  conditions: FlagCondition[];
  value: unknown;
  rolloutPercentage?: number;
}

export interface FlagDefinition {
  key: string;
  name: string;
  description?: string;
  type: 'boolean' | 'string' | 'number' | 'json';
  defaultValue: unknown;
  enabled: boolean;
  rules: FlagRule[];
  tags?: string[];
}

export interface FlagConfigResponse {
  flags: Record<string, FlagDefinition>;
  flagCount: number;
}

// ── Callbacks ────────────────────────────────────────────────────────────

export type FlagChangeListener = (newValue: unknown, previousValue?: unknown) => void;
