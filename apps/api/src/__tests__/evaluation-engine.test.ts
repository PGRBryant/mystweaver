import { describe, it, expect } from 'vitest';
import {
  evaluateFlag,
  rolloutHash,
  matchesCondition,
} from '../services/evaluation-engine';
import type { FlagDocument, EvaluationContext, RuleCondition } from '../types/flag';

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
    createdAt: {} as FirebaseFirestore.Timestamp,
    updatedAt: {} as FirebaseFirestore.Timestamp,
    createdBy: 'test',
    ...overrides,
  };
}

const ctx: EvaluationContext = {
  userId: 'user-123',
  email: 'alice@example.com',
  country: 'US',
  plan: 'pro',
  age: '30',
};

// ── Kill switch ──────────────────────────────────────────────────────────────

describe('kill switch', () => {
  it('returns defaultValue when flag is disabled', () => {
    const flag = makeFlag({
      enabled: false,
      defaultValue: 'off',
      rules: [{ conditions: [], value: 'on' }],
    });
    expect(evaluateFlag(flag, ctx)).toBe('off');
  });
});

// ── No rules ─────────────────────────────────────────────────────────────────

describe('no rules', () => {
  it('returns defaultValue when there are no rules', () => {
    expect(evaluateFlag(makeFlag({ defaultValue: 42 }), ctx)).toBe(42);
  });
});

// ── Rule matching ────────────────────────────────────────────────────────────

describe('rule matching', () => {
  it('returns rule value on match', () => {
    const flag = makeFlag({
      rules: [
        {
          conditions: [{ attribute: 'country', operator: 'equals', value: 'US' }],
          value: true,
        },
      ],
    });
    expect(evaluateFlag(flag, ctx)).toBe(true);
  });

  it('falls through to defaultValue when no rule matches', () => {
    const flag = makeFlag({
      defaultValue: 'default',
      rules: [
        {
          conditions: [{ attribute: 'country', operator: 'equals', value: 'CA' }],
          value: 'canada',
        },
      ],
    });
    expect(evaluateFlag(flag, ctx)).toBe('default');
  });

  it('first matching rule wins', () => {
    const flag = makeFlag({
      rules: [
        {
          conditions: [{ attribute: 'plan', operator: 'equals', value: 'pro' }],
          value: 'first',
        },
        {
          conditions: [{ attribute: 'country', operator: 'equals', value: 'US' }],
          value: 'second',
        },
      ],
    });
    expect(evaluateFlag(flag, ctx)).toBe('first');
  });
});

// ── AND conditions ───────────────────────────────────────────────────────────

describe('AND conditions', () => {
  it('matches when all conditions pass', () => {
    const flag = makeFlag({
      rules: [
        {
          conditions: [
            { attribute: 'country', operator: 'equals', value: 'US' },
            { attribute: 'plan', operator: 'equals', value: 'pro' },
          ],
          value: 'matched',
        },
      ],
    });
    expect(evaluateFlag(flag, ctx)).toBe('matched');
  });

  it('does not match when one condition fails', () => {
    const flag = makeFlag({
      defaultValue: 'default',
      rules: [
        {
          conditions: [
            { attribute: 'country', operator: 'equals', value: 'US' },
            { attribute: 'plan', operator: 'equals', value: 'enterprise' },
          ],
          value: 'matched',
        },
      ],
    });
    expect(evaluateFlag(flag, ctx)).toBe('default');
  });
});

// ── Operators ────────────────────────────────────────────────────────────────

describe('operators', () => {
  const testCondition = (cond: RuleCondition) =>
    matchesCondition(ctx, cond);

  it('equals', () => {
    expect(testCondition({ attribute: 'country', operator: 'equals', value: 'US' })).toBe(true);
    expect(testCondition({ attribute: 'country', operator: 'equals', value: 'CA' })).toBe(false);
  });

  it('not_equals', () => {
    expect(testCondition({ attribute: 'country', operator: 'not_equals', value: 'CA' })).toBe(true);
    expect(testCondition({ attribute: 'country', operator: 'not_equals', value: 'US' })).toBe(false);
  });

  it('contains', () => {
    expect(testCondition({ attribute: 'email', operator: 'contains', value: 'example' })).toBe(true);
    expect(testCondition({ attribute: 'email', operator: 'contains', value: 'gmail' })).toBe(false);
  });

  it('not_contains', () => {
    expect(testCondition({ attribute: 'email', operator: 'not_contains', value: 'gmail' })).toBe(true);
    expect(testCondition({ attribute: 'email', operator: 'not_contains', value: 'example' })).toBe(false);
  });

  it('starts_with', () => {
    expect(testCondition({ attribute: 'email', operator: 'starts_with', value: 'alice' })).toBe(true);
    expect(testCondition({ attribute: 'email', operator: 'starts_with', value: 'bob' })).toBe(false);
  });

  it('ends_with', () => {
    expect(testCondition({ attribute: 'email', operator: 'ends_with', value: '.com' })).toBe(true);
    expect(testCondition({ attribute: 'email', operator: 'ends_with', value: '.org' })).toBe(false);
  });

  it('in_list', () => {
    expect(testCondition({ attribute: 'country', operator: 'in_list', value: ['US', 'CA', 'UK'] })).toBe(true);
    expect(testCondition({ attribute: 'country', operator: 'in_list', value: ['CA', 'UK'] })).toBe(false);
  });

  it('not_in_list', () => {
    expect(testCondition({ attribute: 'country', operator: 'not_in_list', value: ['CA', 'UK'] })).toBe(true);
    expect(testCondition({ attribute: 'country', operator: 'not_in_list', value: ['US', 'CA'] })).toBe(false);
  });

  it('greater_than', () => {
    expect(testCondition({ attribute: 'age', operator: 'greater_than', value: 25 })).toBe(true);
    expect(testCondition({ attribute: 'age', operator: 'greater_than', value: 35 })).toBe(false);
  });

  it('less_than', () => {
    expect(testCondition({ attribute: 'age', operator: 'less_than', value: 35 })).toBe(true);
    expect(testCondition({ attribute: 'age', operator: 'less_than', value: 25 })).toBe(false);
  });

  it('regex', () => {
    expect(testCondition({ attribute: 'email', operator: 'regex', value: '^alice@.*\\.com$' })).toBe(true);
    expect(testCondition({ attribute: 'email', operator: 'regex', value: '^bob@' })).toBe(false);
  });

  it('regex with invalid pattern returns false', () => {
    expect(testCondition({ attribute: 'email', operator: 'regex', value: '[invalid' })).toBe(false);
  });

  it('missing attribute returns false', () => {
    expect(testCondition({ attribute: 'nonexistent', operator: 'equals', value: 'x' })).toBe(false);
  });
});

// ── Percentage rollout ───────────────────────────────────────────────────────

describe('percentage rollout', () => {
  it('0% rollout never matches', () => {
    const flag = makeFlag({
      rules: [{ conditions: [], rolloutPercentage: 0, value: true }],
    });
    // Test several users.
    for (let i = 0; i < 100; i++) {
      expect(evaluateFlag(flag, { userId: `user-${i}` })).toBe(false);
    }
  });

  it('100% rollout always matches', () => {
    const flag = makeFlag({
      rules: [{ conditions: [], rolloutPercentage: 100, value: true }],
    });
    for (let i = 0; i < 100; i++) {
      expect(evaluateFlag(flag, { userId: `user-${i}` })).toBe(true);
    }
  });

  it('omitted percentage acts as 100%', () => {
    const flag = makeFlag({
      rules: [{ conditions: [], value: true }],
    });
    expect(evaluateFlag(flag, ctx)).toBe(true);
  });

  it('is deterministic for the same userId + flagKey', () => {
    const flag = makeFlag({
      rules: [{ conditions: [], rolloutPercentage: 50, value: true }],
    });
    const result1 = evaluateFlag(flag, { userId: 'deterministic-user' });
    const result2 = evaluateFlag(flag, { userId: 'deterministic-user' });
    expect(result1).toBe(result2);
  });

  it('produces roughly even distribution at 50%', () => {
    const flag = makeFlag({
      key: 'distribution-test',
      rules: [{ conditions: [], rolloutPercentage: 50, value: true }],
    });
    let trueCount = 0;
    const total = 10000;
    for (let i = 0; i < total; i++) {
      if (evaluateFlag(flag, { userId: `user-${i}` }) === true) trueCount++;
    }
    // Expect roughly 50% ± 5%.
    expect(trueCount / total).toBeGreaterThan(0.45);
    expect(trueCount / total).toBeLessThan(0.55);
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

// ── Flag types ───────────────────────────────────────────────────────────────

describe('flag value types', () => {
  it('returns string value', () => {
    const flag = makeFlag({
      type: 'string',
      defaultValue: 'default',
      rules: [
        {
          conditions: [{ attribute: 'userId', operator: 'equals', value: 'user-123' }],
          value: 'variant-a',
        },
      ],
    });
    expect(evaluateFlag(flag, ctx)).toBe('variant-a');
  });

  it('returns number value', () => {
    const flag = makeFlag({
      type: 'number',
      defaultValue: 0,
      rules: [{ conditions: [], value: 42 }],
    });
    expect(evaluateFlag(flag, ctx)).toBe(42);
  });

  it('returns JSON value', () => {
    const jsonVal = { color: 'blue', size: 'large' };
    const flag = makeFlag({
      type: 'json',
      defaultValue: {},
      rules: [{ conditions: [], value: jsonVal }],
    });
    expect(evaluateFlag(flag, ctx)).toEqual(jsonVal);
  });
});
