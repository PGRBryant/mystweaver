export type FlagType = 'boolean' | 'string' | 'number' | 'json';

export type Operator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in_list'
  | 'not_in_list'
  | 'greater_than'
  | 'less_than'
  | 'regex';

export interface RuleCondition {
  attribute: string;
  operator: Operator;
  value: unknown;
}

export interface TargetingRule {
  description?: string;
  conditions: RuleCondition[];
  rolloutPercentage?: number; // 0–100; omit or 100 = all who match
  value: unknown;
}

export interface FlagDocument {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  type: FlagType;
  defaultValue: unknown;
  rules: TargetingRule[];
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdBy: string;
}

export interface EvaluationContext {
  userId: string;
  email?: string;
  [key: string]: unknown;
}
