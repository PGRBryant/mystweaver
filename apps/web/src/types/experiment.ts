export type ExperimentStatus = 'draft' | 'running' | 'stopped' | 'concluded';

export interface ExperimentVariant {
  key: string;
  value: unknown;
  weight: number;
}

export interface Experiment {
  id: string;
  name: string;
  flagKey: string;
  variants: ExperimentVariant[];
  metric: string;
  status: ExperimentStatus;
  startedAt?: string | null;
  stoppedAt?: string | null;
  concludedAt?: string | null;
  winner?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

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
