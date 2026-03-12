export type FlagType = 'boolean' | 'string' | 'number' | 'json';

export type Operator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';

export interface Condition {
  attribute: string;
  operator: Operator;
  value: unknown;
}

export interface TargetingRule {
  id: string;
  description: string;
  conditions: Condition[];
  value: unknown;
  rolloutPercentage?: number;
}

export interface Flag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  type: FlagType;
  defaultValue: unknown;
  rules: TargetingRule[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateFlagData {
  key: string;
  name: string;
  description?: string;
  type: FlagType;
  defaultValue: unknown;
  enabled?: boolean;
  rules?: TargetingRule[];
  tags?: string[];
}

export interface UpdateFlagData {
  name?: string;
  description?: string;
  enabled?: boolean;
  defaultValue?: unknown;
  rules?: TargetingRule[];
  tags?: string[];
}

export interface EvaluateResult {
  flagKey: string;
  value: unknown;
  type: FlagType;
  reason: string;
  ruleId?: string;
  enabled: boolean;
  evaluatedAt: number;
}
