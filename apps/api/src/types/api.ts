import type { FlagType, TargetingRule, UserContext } from './flag';

// ── Flag CRUD ───────────────────────────────────────────────────────────

export interface CreateFlagRequest {
  key: string;
  name: string;
  description?: string;
  type: FlagType;
  defaultValue: unknown;
  enabled?: boolean;
  rules?: TargetingRule[];
  tags?: string[];
}

export interface UpdateFlagRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  defaultValue?: unknown;
  rules?: TargetingRule[];
  tags?: string[];
}

// ── SDK Evaluate ────────────────────────────────────────────────────────

export interface EvaluateRequest {
  flagKey: string;
  userContext: UserContext;
}

export interface BulkEvaluateRequest {
  flags: string[];
  userContext: UserContext;
}

// ── SDK Events ──────────────────────────────────────────────────────────

export interface SDKEvent {
  type: string;
  flagKey?: string;
  event?: string;
  userId?: string;
  value?: unknown;
  properties?: Record<string, unknown>;
  timestamp: number;
}

export interface EventIngestionRequest {
  events: SDKEvent[];
}
