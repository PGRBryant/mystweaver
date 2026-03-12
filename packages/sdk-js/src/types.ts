// ── Configuration ────────────────────────────────────────────────────────

export interface MystweaverConfig {
  /** SDK API key (e.g. "mw_sdk_live_...") */
  apiKey: string;
  /** Base URL of the Mystweaver API (e.g. "https://api.mystweaver.dev") */
  baseUrl: string;
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

// ── Callbacks ────────────────────────────────────────────────────────────

export type FlagChangeListener = (newValue: unknown, previousValue?: unknown) => void;
