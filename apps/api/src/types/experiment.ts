import type { Timestamp } from '@google-cloud/firestore';

export type ExperimentStatus = 'draft' | 'running' | 'stopped' | 'concluded';

export interface ExperimentVariant {
  key: string;
  value: unknown;
  weight: number; // 0–100, all variants should sum to 100
}

export interface ExperimentDocument {
  id: string;
  name: string;
  flagKey: string;
  variants: ExperimentVariant[];
  metric: string; // event name, e.g. "room.completed"
  status: ExperimentStatus;
  startedAt?: Timestamp | null;
  stoppedAt?: Timestamp | null;
  concludedAt?: Timestamp | null;
  winner?: string | null; // winning variant key
  previousFlagState?: {
    rules: unknown[];
    defaultValue: unknown;
    enabled: boolean;
  } | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── API request types ────────────────────────────────────────────────────

export interface CreateExperimentRequest {
  name: string;
  flagKey: string;
  variants: ExperimentVariant[];
  metric: string;
}

export interface UpdateExperimentRequest {
  name?: string;
  metric?: string;
  variants?: ExperimentVariant[];
}

// ── Results ──────────────────────────────────────────────────────────────

export interface VariantResult {
  sampleSize: number;
  conversionRate: number;
  mean: number;
  stdDev: number;
}

export interface ExperimentResults {
  experimentId: string;
  status: ExperimentStatus;
  variants: Record<string, VariantResult>;
  winner: string | null;
  pValue: number | null;
  significanceReached: boolean;
  confidenceLevel: number;
  updatedAt: number;
}
