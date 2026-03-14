import { describe, it, expect } from 'vitest';
import { evaluateFlag, rolloutHash, matchesCondition } from '../services/evaluation-engine';
import type { FlagDocument, UserContext, Condition } from '../types/flag';
import type { Timestamp } from '@google-cloud/firestore';

// Helper to build a minimal flag.
function makeFlag(overrides: Partial<FlagDocument> = {}): FlagDocument {
  return {
    key: 'test-flag',
    name: 'Test Flag',
    description: '',
    enabled: true,
    type: 'boolean',
    defaultValue: false,
    rules: [],
    tags: [],
    deletedAt: null,
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    createdBy: 'test',
    ...overrides,
  };
}

// Helper to build a rule with defaults.
function makeRule(overrides: Partial<FlagDocument['rules'][0]> = {}) {
  return {
    id: 'rule-1',
    description: 'Test rule',
    conditions: [],
    value: true,
    ...overrides,
  };
}

const ctx: UserContext = {
  id: 'user-123',
  attributes: {
    email: 'alice@example.com',
    country: 'US',
    plan: 'pro',
    age: 30,
    skillTier: 'struggling',
    percentileRank: 0.1,
  },
};

// ── Flag not found ───────────────────────────────────────────────────────────

describe('flag not found', () => {
  it('returns null value with flag_not_found reason', () => {
    const result = evaluateFlag(null, 'nonexistent', ctx);
    expect(result.value).toBeNull();
    expect(result.reason).toBe('flag_not_found');
    expect(result.enabled).toBe(false);
    expect(result.flagKey).toBe('nonexistent');
  });
});

// ── Kill switch ──────────────────────────────────────────────────────────────

describe('kill switch', () => {
  it('returns defaultValue when flag is disabled', () => {
    const flag = makeFlag({
      enabled: false,
      defaultValue: 'off',
      rules: [makeRule({ value: 'on' })],
    });
    const result = evaluateFlag(flag, 'test-flag', ctx);
    expect(result.value).toBe('off');
    expect(result.reason).toBe('flag_disabled');
    expect(result.enabled).toBe(false);
  });
});

// ── No rules ─────────────────────────────────────────────────────────────────

describe('no rules', () => {
  it('returns defaultValue with "default" reason', () => {
    const result = evaluateFlag(makeFlag({ defaultValue: 42 }), 'test-flag', ctx);
    expect(result.value).toBe(42);
    expect(result.reason).toBe('default');
    expect(result.enabled).toBe(true);
  });
});

// ── Rule matching ────────────────────────────────────────────────────────────

describe('rule matching', () => {
  it('returns rule value and ruleId on match', () => {
    const flag = makeFlag({
      rules: [
        makeRule({
          id: 'us-users',
          conditions: [{ attribute: 'country', operator: 'eq', value: 'US' }],
          value: true,
        }),
      ],
    });
    const result = evaluateFlag(flag, 'test-flag', ctx);
    expect(result.value).toBe(true);
    expect(result.reason).toBe('rule:us-users');
    expect(result.ruleId).toBe('us-users');
  });

  it('falls through to defaultValue when no rule matches', () => {
    const flag = makeFlag({
      defaultValue: 'default',
      rules: [
        makeRule({
          conditions: [{ attribute: 'country', operator: 'eq', value: 'CA' }],
          value: 'canada',
        }),
      ],
    });
    const result = evaluateFlag(flag, 'test-flag', ctx);
    expect(result.value).toBe('default');
    expect(result.reason).toBe('default');
  });

  it('first matching rule wins', () => {
    const flag = makeFlag({
      rules: [
        makeRule({
          id: 'rule-a',
          conditions: [{ attribute: 'plan', operator: 'eq', value: 'pro' }],
          value: 'first',
        }),
        makeRule({
          id: 'rule-b',
          conditions: [{ attribute: 'country', operator: 'eq', value: 'US' }],
          value: 'second',
        }),
      ],
    });
    const result = evaluateFlag(flag, 'test-flag', ctx);
    expect(result.value).toBe('first');
    expect(result.ruleId).toBe('rule-a');
  });
});

// ── AND conditions ───────────────────────────────────────────────────────────

describe('AND conditions', () => {
  it('matches when all conditions pass', () => {
    const flag = makeFlag({
      rules: [
        makeRule({
          conditions: [
            { attribute: 'country', operator: 'eq', value: 'US' },
            { attribute: 'plan', operator: 'eq', value: 'pro' },
          ],
          value: 'matched',
        }),
      ],
    });
    expect(evaluateFlag(flag, 'test-flag', ctx).value).toBe('matched');
  });

  it('does not match when one condition fails', () => {
    const flag = makeFlag({
      defaultValue: 'default',
      rules: [
        makeRule({
          conditions: [
            { attribute: 'country', operator: 'eq', value: 'US' },
            { attribute: 'plan', operator: 'eq', value: 'enterprise' },
          ],
          value: 'matched',
        }),
      ],
    });
    expect(evaluateFlag(flag, 'test-flag', ctx).value).toBe('default');
  });
});

// ── Operators ────────────────────────────────────────────────────────────────

describe('operators', () => {
  const testCond = (cond: Condition) => matchesCondition(ctx, cond);

  it('eq', () => {
    expect(testCond({ attribute: 'country', operator: 'eq', value: 'US' })).toBe(true);
    expect(testCond({ attribute: 'country', operator: 'eq', value: 'CA' })).toBe(false);
  });

  it('neq', () => {
    expect(testCond({ attribute: 'country', operator: 'neq', value: 'CA' })).toBe(true);
    expect(testCond({ attribute: 'country', operator: 'neq', value: 'US' })).toBe(false);
  });

  it('gt', () => {
    expect(testCond({ attribute: 'age', operator: 'gt', value: 25 })).toBe(true);
    expect(testCond({ attribute: 'age', operator: 'gt', value: 35 })).toBe(false);
  });

  it('lt', () => {
    expect(testCond({ attribute: 'age', operator: 'lt', value: 35 })).toBe(true);
    expect(testCond({ attribute: 'age', operator: 'lt', value: 25 })).toBe(false);
  });

  it('gte', () => {
    expect(testCond({ attribute: 'age', operator: 'gte', value: 30 })).toBe(true);
    expect(testCond({ attribute: 'age', operator: 'gte', value: 31 })).toBe(false);
  });

  it('lte', () => {
    expect(testCond({ attribute: 'age', operator: 'lte', value: 30 })).toBe(true);
    expect(testCond({ attribute: 'age', operator: 'lte', value: 29 })).toBe(false);
  });

  it('in', () => {
    expect(testCond({ attribute: 'country', operator: 'in', value: ['US', 'CA', 'UK'] })).toBe(
      true,
    );
    expect(testCond({ attribute: 'country', operator: 'in', value: ['CA', 'UK'] })).toBe(false);
  });

  it('contains', () => {
    expect(testCond({ attribute: 'email', operator: 'contains', value: 'example' })).toBe(true);
    expect(testCond({ attribute: 'email', operator: 'contains', value: 'gmail' })).toBe(false);
  });

  it('missing attribute returns false', () => {
    expect(testCond({ attribute: 'nonexistent', operator: 'eq', value: 'x' })).toBe(false);
  });

  it('numeric comparison with percentileRank', () => {
    expect(testCond({ attribute: 'percentileRank', operator: 'lt', value: 0.5 })).toBe(true);
    expect(testCond({ attribute: 'percentileRank', operator: 'gt', value: 0.5 })).toBe(false);
  });
});

// ── Percentage rollout ───────────────────────────────────────────────────────

describe('percentage rollout', () => {
  it('0% rollout never matches', () => {
    const flag = makeFlag({
      rules: [makeRule({ conditions: [], rolloutPercentage: 0, value: true })],
    });
    for (let i = 0; i < 100; i++) {
      expect(evaluateFlag(flag, 'test-flag', { id: `user-${i}`, attributes: {} }).value).toBe(
        false,
      );
    }
  });

  it('100% rollout always matches', () => {
    const flag = makeFlag({
      rules: [makeRule({ conditions: [], rolloutPercentage: 100, value: true })],
    });
    for (let i = 0; i < 100; i++) {
      expect(evaluateFlag(flag, 'test-flag', { id: `user-${i}`, attributes: {} }).value).toBe(true);
    }
  });

  it('omitted percentage acts as 100%', () => {
    const flag = makeFlag({
      rules: [makeRule({ conditions: [], value: true })],
    });
    expect(evaluateFlag(flag, 'test-flag', ctx).value).toBe(true);
  });

  it('is deterministic for the same userId + flagKey', () => {
    const flag = makeFlag({
      rules: [makeRule({ conditions: [], rolloutPercentage: 50, value: true })],
    });
    const ctx1: UserContext = { id: 'deterministic-user', attributes: {} };
    const r1 = evaluateFlag(flag, 'test-flag', ctx1).value;
    const r2 = evaluateFlag(flag, 'test-flag', ctx1).value;
    expect(r1).toBe(r2);
  });

  it('produces roughly even distribution at 50% (±2%)', () => {
    const flag = makeFlag({
      key: 'distribution-test',
      rules: [makeRule({ conditions: [], rolloutPercentage: 50, value: true })],
    });
    let trueCount = 0;
    const total = 10000;
    for (let i = 0; i < total; i++) {
      if (
        evaluateFlag(flag, 'distribution-test', { id: `user-${i}`, attributes: {} }).value === true
      ) {
        trueCount++;
      }
    }
    expect(trueCount / total).toBeGreaterThan(0.48);
    expect(trueCount / total).toBeLessThan(0.52);
  });
});

// ── rolloutHash ──────────────────────────────────────────────────────────────

describe('rolloutHash', () => {
  it('returns a number 0-99', () => {
    const hash = rolloutHash('flag', 'user');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(100);
  });

  it('is deterministic', () => {
    expect(rolloutHash('a', 'b')).toBe(rolloutHash('a', 'b'));
  });

  it('varies by flagKey', () => {
    expect(rolloutHash('flag-a', 'user')).not.toBe(rolloutHash('flag-b', 'user'));
  });
});

// ── Rollout hash parity: server vs SDK client ────────────────────────────────
// The server uses Node crypto (sync), the SDK uses Web Crypto (async).
// Both must produce identical results for the same flagKey:userId inputs.
// These test vectors are ground truth — if either implementation changes, this
// test will catch the divergence before it silently splits users differently.

describe('rolloutHash parity (server vs SDK client)', () => {
  /** Mirrors the SDK's rolloutHash using Web Crypto via Node's globalThis.crypto. */
  async function sdkRolloutHash(flagKey: string, userId: string): Promise<number> {
    const data = new TextEncoder().encode(`${flagKey}:${userId}`);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(hashBuffer);
    const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
    return num % 100;
  }

  const vectors: Array<[string, string]> = [
    ['my-flag', 'user-123'],
    ['game.task-timer-seconds', 'player-abc'],
    ['experiment:exp-1:control', 'room404-user-99'],
    ['release.new-ui', ''],
    ['a', 'b'],
    ['flag-with-dashes', 'user_with_underscores'],
  ];

  it.each(vectors)('server and SDK agree for flagKey=%s userId=%s', async (flagKey, userId) => {
    const serverResult = rolloutHash(flagKey, userId);
    const sdkResult = await sdkRolloutHash(flagKey, userId);
    expect(serverResult).toBe(sdkResult);
    expect(serverResult).toBeGreaterThanOrEqual(0);
    expect(serverResult).toBeLessThan(100);
  });
});

// ── Flag value types ─────────────────────────────────────────────────────────

describe('flag value types', () => {
  it('returns string value', () => {
    const flag = makeFlag({
      type: 'string',
      defaultValue: 'default',
      rules: [
        makeRule({
          conditions: [{ attribute: 'country', operator: 'eq', value: 'US' }],
          value: 'variant-a',
        }),
      ],
    });
    expect(evaluateFlag(flag, 'test-flag', ctx).value).toBe('variant-a');
  });

  it('returns number value', () => {
    const flag = makeFlag({
      type: 'number',
      defaultValue: 0,
      rules: [makeRule({ conditions: [], value: 42 })],
    });
    expect(evaluateFlag(flag, 'test-flag', ctx).value).toBe(42);
  });

  it('returns JSON value', () => {
    const jsonVal = { color: 'blue', size: 'large' };
    const flag = makeFlag({
      type: 'json',
      defaultValue: {},
      rules: [makeRule({ conditions: [], value: jsonVal })],
    });
    expect(evaluateFlag(flag, 'test-flag', ctx).value).toEqual(jsonVal);
  });
});

// ── evaluatedAt ──────────────────────────────────────────────────────────────

describe('evaluatedAt', () => {
  it('includes evaluatedAt as unix timestamp', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = evaluateFlag(makeFlag(), 'test-flag', ctx);
    expect(result.evaluatedAt).toBeGreaterThanOrEqual(now - 1);
    expect(result.evaluatedAt).toBeLessThanOrEqual(now + 1);
  });
});

// ── Room 404 targeting scenarios ─────────────────────────────────────────────

describe('Room 404 targeting scenarios', () => {
  it('targets struggling players with longer timer', () => {
    const flag = makeFlag({
      key: 'game.task-timer-seconds',
      type: 'number',
      defaultValue: 8,
      rules: [
        makeRule({
          id: 'skill-tier-struggling',
          conditions: [{ attribute: 'skillTier', operator: 'eq', value: 'struggling' }],
          value: 12,
        }),
      ],
    });

    const struggling: UserContext = { id: 'plr_1', attributes: { skillTier: 'struggling' } };
    const normal: UserContext = { id: 'plr_2', attributes: { skillTier: 'normal' } };

    expect(evaluateFlag(flag, 'game.task-timer-seconds', struggling).value).toBe(12);
    expect(evaluateFlag(flag, 'game.task-timer-seconds', struggling).reason).toBe(
      'rule:skill-tier-struggling',
    );
    expect(evaluateFlag(flag, 'game.task-timer-seconds', normal).value).toBe(8);
    expect(evaluateFlag(flag, 'game.task-timer-seconds', normal).reason).toBe('default');
  });

  it('targets low percentile rank with numeric comparison', () => {
    const flag = makeFlag({
      key: 'game.lives-per-floor',
      type: 'number',
      defaultValue: 3,
      rules: [
        makeRule({
          id: 'bottom-10-pct',
          conditions: [{ attribute: 'percentileRank', operator: 'lte', value: 0.1 }],
          value: 5,
        }),
      ],
    });

    const low: UserContext = { id: 'plr_1', attributes: { percentileRank: 0.05 } };
    const high: UserContext = { id: 'plr_2', attributes: { percentileRank: 0.8 } };

    expect(evaluateFlag(flag, 'game.lives-per-floor', low).value).toBe(5);
    expect(evaluateFlag(flag, 'game.lives-per-floor', high).value).toBe(3);
  });
});
