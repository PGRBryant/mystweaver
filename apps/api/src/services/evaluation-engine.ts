import { createHash } from 'crypto';
import type {
  FlagDocument,
  EvaluationContext,
  RuleCondition,
  TargetingRule,
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
  context: EvaluationContext,
  condition: RuleCondition,
): boolean {
  const raw = context[condition.attribute];
  if (raw === undefined || raw === null) return false;

  const ctxVal = String(raw);
  const condVal = condition.value;

  switch (condition.operator) {
    case 'equals':
      return ctxVal === String(condVal);
    case 'not_equals':
      return ctxVal !== String(condVal);
    case 'contains':
      return ctxVal.includes(String(condVal));
    case 'not_contains':
      return !ctxVal.includes(String(condVal));
    case 'starts_with':
      return ctxVal.startsWith(String(condVal));
    case 'ends_with':
      return ctxVal.endsWith(String(condVal));
    case 'in_list':
      return Array.isArray(condVal) && condVal.map(String).includes(ctxVal);
    case 'not_in_list':
      return !Array.isArray(condVal) || !condVal.map(String).includes(ctxVal);
    case 'greater_than':
      return Number(raw) > Number(condVal);
    case 'less_than':
      return Number(raw) < Number(condVal);
    case 'regex':
      try {
        return new RegExp(String(condVal)).test(ctxVal);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function ruleMatches(
  rule: TargetingRule,
  flag: FlagDocument,
  context: EvaluationContext,
): boolean {
  // All conditions must match (AND logic).
  if (!rule.conditions.every((c) => matchesCondition(context, c))) {
    return false;
  }

  // Check percentage rollout.
  const pct = rule.rolloutPercentage;
  if (pct !== undefined && pct < 100) {
    return rolloutHash(flag.key, context.userId) < pct;
  }

  return true;
}

/**
 * Pure evaluation function. No I/O, no side effects.
 * Rules are evaluated in order; first match wins.
 * Returns defaultValue if disabled or no rule matches.
 */
export function evaluateFlag(
  flag: FlagDocument,
  context: EvaluationContext,
): unknown {
  if (!flag.enabled) return flag.defaultValue;

  for (const rule of flag.rules) {
    if (ruleMatches(rule, flag, context)) {
      return rule.value;
    }
  }

  return flag.defaultValue;
}

// Exported for testing only.
export { rolloutHash, matchesCondition };
