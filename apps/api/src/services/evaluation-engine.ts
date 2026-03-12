import { createHash } from 'crypto';
import type {
  FlagDocument,
  UserContext,
  Condition,
  TargetingRule,
  EvaluationResult,
} from '../types/flag';

/**
 * Deterministic hash for percentage rollouts.
 * SHA-256 of "flagKey:userId", first 8 hex chars → int mod 100 → 0–99.
 */
function rolloutHash(flagKey: string, userId: string): number {
  const digest = createHash('sha256')
    .update(`${flagKey}:${userId}`)
    .digest('hex');
  return parseInt(digest.substring(0, 8), 16) % 100;
}

function matchesCondition(
  context: UserContext,
  condition: Condition,
): boolean {
  const raw = context.attributes[condition.attribute];
  if (raw === undefined || raw === null) return false;

  const condVal = condition.value;

  switch (condition.operator) {
    case 'eq':
      return raw === condVal || String(raw) === String(condVal);
    case 'neq':
      return raw !== condVal && String(raw) !== String(condVal);
    case 'gt':
      return Number(raw) > Number(condVal);
    case 'lt':
      return Number(raw) < Number(condVal);
    case 'gte':
      return Number(raw) >= Number(condVal);
    case 'lte':
      return Number(raw) <= Number(condVal);
    case 'in':
      return Array.isArray(condVal) && condVal.some((v) => String(v) === String(raw));
    case 'contains':
      return String(raw).includes(String(condVal));
    default:
      return false;
  }
}

function ruleMatches(
  rule: TargetingRule,
  flag: FlagDocument,
  context: UserContext,
): boolean {
  // All conditions must match (AND logic).
  if (!rule.conditions.every((c) => matchesCondition(context, c))) {
    return false;
  }

  // Check percentage rollout.
  const pct = rule.rolloutPercentage;
  if (pct !== undefined && pct < 100) {
    return rolloutHash(flag.key, context.id) < pct;
  }

  return true;
}

/**
 * Evaluate a single flag for a user context.
 * Pure function — no I/O, deterministic.
 */
export function evaluateFlag(
  flag: FlagDocument | null,
  flagKey: string,
  context: UserContext,
): EvaluationResult {
  const now = Math.floor(Date.now() / 1000);

  // Flag not found.
  if (!flag) {
    return {
      flagKey,
      value: null,
      type: 'boolean',
      reason: 'flag_not_found',
      enabled: false,
      evaluatedAt: now,
    };
  }

  // Flag disabled.
  if (!flag.enabled) {
    return {
      flagKey,
      value: flag.defaultValue,
      type: flag.type,
      reason: 'flag_disabled',
      enabled: false,
      evaluatedAt: now,
    };
  }

  // Evaluate rules in order — first match wins.
  for (const rule of flag.rules) {
    if (ruleMatches(rule, flag, context)) {
      return {
        flagKey,
        value: rule.value,
        type: flag.type,
        reason: `rule:${rule.id}`,
        ruleId: rule.id,
        enabled: true,
        evaluatedAt: now,
      };
    }
  }

  // No rules matched — return default.
  return {
    flagKey,
    value: flag.defaultValue,
    type: flag.type,
    reason: 'default',
    enabled: true,
    evaluatedAt: now,
  };
}

// Exported for testing only.
export { rolloutHash, matchesCondition };
