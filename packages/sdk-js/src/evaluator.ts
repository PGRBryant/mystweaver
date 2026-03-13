/**
 * Local flag evaluation engine — port of the server's evaluation-engine.ts.
 *
 * Uses Web Crypto API for SHA-256 rollout hashing (works in browsers + Node 18+).
 * Produces identical rollout buckets to the server implementation.
 */

import type { FlagDefinition, FlagCondition, FlagRule, UserContext } from './types';

/**
 * Deterministic hash for percentage rollouts.
 * SHA-256 of "flagKey:userId", first 4 bytes as uint32, mod 100 → 0–99.
 * Matches the server's `rolloutHash()` output exactly.
 */
async function rolloutHash(flagKey: string, userId: string): Promise<number> {
  const data = new TextEncoder().encode(`${flagKey}:${userId}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  // Equivalent to: parseInt(hexDigest.substring(0, 8), 16) % 100
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return num % 100;
}

function matchesCondition(context: UserContext, condition: FlagCondition): boolean {
  const attrs = context.attributes ?? {};
  const raw = attrs[condition.attribute];
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

async function ruleMatches(
  rule: FlagRule,
  flagKey: string,
  context: UserContext,
): Promise<boolean> {
  // All conditions must match (AND logic).
  if (!rule.conditions.every((c) => matchesCondition(context, c))) {
    return false;
  }

  // Check percentage rollout.
  const pct = rule.rolloutPercentage;
  if (pct !== undefined && pct < 100) {
    return (await rolloutHash(flagKey, context.id)) < pct;
  }

  return true;
}

/**
 * Evaluate a single flag locally using the downloaded config.
 * Returns the resolved value (not an EvaluationResult — the client handles typing).
 */
export async function evaluateLocally(
  flag: FlagDefinition | undefined,
  flagKey: string,
  context: UserContext,
): Promise<{ value: unknown; found: boolean }> {
  if (!flag) {
    return { value: null, found: false };
  }

  if (!flag.enabled) {
    return { value: flag.defaultValue, found: true };
  }

  // Evaluate rules in order — first match wins.
  for (const rule of flag.rules ?? []) {
    if (await ruleMatches(rule, flagKey, context)) {
      return { value: rule.value, found: true };
    }
  }

  // No rules matched — return default.
  return { value: flag.defaultValue, found: true };
}
