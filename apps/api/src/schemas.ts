import { z } from 'zod';

// ── Shared ──────────────────────────────────────────────────────────────

const flagTypeSchema = z.enum(['boolean', 'string', 'number', 'json']);
const operatorSchema = z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'contains']);

const conditionSchema = z.object({
  attribute: z.string().min(1),
  operator: operatorSchema,
  value: z.unknown(),
});

const targetingRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  conditions: z.array(conditionSchema),
  value: z.unknown(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
});

const userContextSchema = z.object({
  id: z.string().min(1),
  attributes: z.record(z.string(), z.unknown()),
});

// ── Type–value validation ────────────────────────────────────────────────

/** Check whether a value matches a declared flag type. */
export function matchesFlagType(type: string, value: unknown): boolean {
  switch (type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'json':
      return value !== null && typeof value === 'object';
    default:
      return false;
  }
}

// ── Flags ───────────────────────────────────────────────────────────────

export const createFlagSchema = z
  .object({
    key: z.string().min(2).max(100),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    type: flagTypeSchema,
    defaultValue: z.unknown(),
    enabled: z.boolean().optional(),
    rules: z.array(targetingRuleSchema).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  })
  .superRefine((data, ctx) => {
    if (!matchesFlagType(data.type, data.defaultValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultValue'],
        message: `defaultValue must be a ${data.type}`,
      });
    }
  });

export const updateFlagSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  rules: z.array(targetingRuleSchema).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// ── SDK Evaluate ────────────────────────────────────────────────────────

export const evaluateSchema = z.object({
  flagKey: z.string().min(1),
  userContext: userContextSchema,
});

export const bulkEvaluateSchema = z.object({
  flags: z.array(z.string().min(1)).min(1).max(50),
  userContext: userContextSchema,
});

// ── SDK Events ──────────────────────────────────────────────────────────

const sdkEventSchema = z.object({
  type: z.string().min(1),
  flagKey: z.string().optional(),
  event: z.string().optional(),
  userId: z.string().optional(),
  value: z.unknown().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.number(),
});

export const eventIngestionSchema = z.object({
  events: z.array(sdkEventSchema).min(1),
});

// ── SDK Keys ────────────────────────────────────────────────────────────

export const createSDKKeySchema = z.object({
  name: z.string().min(1).max(100),
  projectId: z.string().min(1).max(100),
});

// ── Experiments ─────────────────────────────────────────────────────────

const experimentVariantSchema = z.object({
  key: z.string().min(1).max(50),
  value: z.unknown(),
  weight: z.number().min(0).max(100),
});

export const createExperimentSchema = z.object({
  name: z.string().min(1).max(200),
  flagKey: z.string().min(1),
  variants: z.array(experimentVariantSchema).min(2),
  metric: z.string().min(1),
});

export const updateExperimentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  metric: z.string().min(1).optional(),
  variants: z.array(experimentVariantSchema).min(2).optional(),
});

export const concludeExperimentSchema = z.object({
  winner: z.string().min(1),
});
