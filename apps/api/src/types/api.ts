import type { FlagType, TargetingRule, EvaluationContext } from './flag';

export interface CreateFlagRequest {
  key: string;
  name: string;
  description?: string;
  type: FlagType;
  defaultValue: unknown;
  enabled?: boolean;
  rules?: TargetingRule[];
}

export interface UpdateFlagRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  defaultValue?: unknown;
  rules?: TargetingRule[];
}

export interface EvaluateRequest {
  flagKey: string;
  context: EvaluationContext;
}

export interface BatchEvaluateRequest {
  flagKeys: string[];
  context: EvaluationContext;
}

export interface EvaluateResponse {
  flagKey: string;
  value: unknown;
  type: FlagType;
}

export interface BatchEvaluateResponse {
  results: EvaluateResponse[];
}
