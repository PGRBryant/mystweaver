import { describe, it, expect } from 'vitest';
import {
  createFlagSchema,
  updateFlagSchema,
  evaluateSchema,
  bulkEvaluateSchema,
  eventIngestionSchema,
  createSDKKeySchema,
  createExperimentSchema,
  updateExperimentSchema,
  concludeExperimentSchema,
  matchesFlagType,
} from '../schemas';

describe('createFlagSchema', () => {
  it('accepts valid flag', () => {
    const result = createFlagSchema.safeParse({
      key: 'my-flag',
      name: 'My Flag',
      type: 'boolean',
      defaultValue: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts flag with all optional fields', () => {
    const result = createFlagSchema.safeParse({
      key: 'my-flag',
      name: 'My Flag',
      type: 'number',
      defaultValue: 42,
      description: 'A test flag',
      enabled: false,
      rules: [
        {
          id: 'r1',
          description: 'rule 1',
          conditions: [{ attribute: 'plan', operator: 'eq', value: 'pro' }],
          value: 100,
          rolloutPercentage: 50,
        },
      ],
      tags: ['game', 'timer'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing key', () => {
    const result = createFlagSchema.safeParse({ name: 'X', type: 'boolean', defaultValue: true });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'invalid',
      defaultValue: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects key shorter than 2 characters', () => {
    const result = createFlagSchema.safeParse({
      key: 'a',
      name: 'X',
      type: 'boolean',
      defaultValue: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid operator in rules', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'boolean',
      defaultValue: true,
      rules: [
        {
          id: 'r1',
          description: '',
          conditions: [{ attribute: 'x', operator: 'INVALID', value: 1 }],
          value: true,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects rolloutPercentage > 100', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'boolean',
      defaultValue: true,
      rules: [{ id: 'r1', description: '', conditions: [], value: true, rolloutPercentage: 150 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects defaultValue that does not match type (string for boolean flag)', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'boolean',
      defaultValue: 'not-a-bool',
    });
    expect(result.success).toBe(false);
  });

  it('rejects defaultValue that does not match type (boolean for number flag)', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'number',
      defaultValue: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects defaultValue that does not match type (number for string flag)', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'string',
      defaultValue: 42,
    });
    expect(result.success).toBe(false);
  });

  it('rejects defaultValue that does not match type (string for json flag)', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'json',
      defaultValue: 'not-json',
    });
    expect(result.success).toBe(false);
  });

  it('accepts json flag with object defaultValue', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'json',
      defaultValue: { theme: 'dark', fontSize: 14 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts json flag with array defaultValue', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'json',
      defaultValue: [1, 2, 3],
    });
    expect(result.success).toBe(true);
  });

  it('rejects NaN for number flag', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'number',
      defaultValue: NaN,
    });
    expect(result.success).toBe(false);
  });

  it('rejects null for json flag', () => {
    const result = createFlagSchema.safeParse({
      key: 'ab',
      name: 'X',
      type: 'json',
      defaultValue: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('matchesFlagType', () => {
  it('boolean accepts true/false', () => {
    expect(matchesFlagType('boolean', true)).toBe(true);
    expect(matchesFlagType('boolean', false)).toBe(true);
  });

  it('boolean rejects non-booleans', () => {
    expect(matchesFlagType('boolean', 'yes')).toBe(false);
    expect(matchesFlagType('boolean', 1)).toBe(false);
    expect(matchesFlagType('boolean', null)).toBe(false);
  });

  it('string accepts strings', () => {
    expect(matchesFlagType('string', 'hello')).toBe(true);
    expect(matchesFlagType('string', '')).toBe(true);
  });

  it('string rejects non-strings', () => {
    expect(matchesFlagType('string', 42)).toBe(false);
    expect(matchesFlagType('string', true)).toBe(false);
  });

  it('number accepts finite numbers', () => {
    expect(matchesFlagType('number', 42)).toBe(true);
    expect(matchesFlagType('number', 0)).toBe(true);
    expect(matchesFlagType('number', -3.14)).toBe(true);
  });

  it('number rejects NaN and Infinity', () => {
    expect(matchesFlagType('number', NaN)).toBe(false);
    expect(matchesFlagType('number', Infinity)).toBe(false);
    expect(matchesFlagType('number', -Infinity)).toBe(false);
  });

  it('json accepts objects and arrays', () => {
    expect(matchesFlagType('json', { a: 1 })).toBe(true);
    expect(matchesFlagType('json', [1, 2])).toBe(true);
    expect(matchesFlagType('json', {})).toBe(true);
  });

  it('json rejects null and primitives', () => {
    expect(matchesFlagType('json', null)).toBe(false);
    expect(matchesFlagType('json', 'string')).toBe(false);
    expect(matchesFlagType('json', 42)).toBe(false);
  });

  it('unknown type returns false', () => {
    expect(matchesFlagType('unknown', 'x')).toBe(false);
  });
});

describe('updateFlagSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = updateFlagSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update', () => {
    const result = updateFlagSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
  });
});

describe('evaluateSchema', () => {
  it('accepts valid evaluate request', () => {
    const result = evaluateSchema.safeParse({
      flagKey: 'game.timer',
      userContext: { id: 'user-1', attributes: { plan: 'pro' } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing userContext.id', () => {
    const result = evaluateSchema.safeParse({
      flagKey: 'game.timer',
      userContext: { attributes: {} },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty flagKey', () => {
    const result = evaluateSchema.safeParse({
      flagKey: '',
      userContext: { id: 'u1', attributes: {} },
    });
    expect(result.success).toBe(false);
  });
});

describe('bulkEvaluateSchema', () => {
  it('accepts valid bulk request', () => {
    const result = bulkEvaluateSchema.safeParse({
      flags: ['flag-a', 'flag-b'],
      userContext: { id: 'u1', attributes: {} },
    });
    expect(result.success).toBe(true);
  });

  it('rejects > 50 flags', () => {
    const flags = Array.from({ length: 51 }, (_, i) => `flag-${i}`);
    const result = bulkEvaluateSchema.safeParse({
      flags,
      userContext: { id: 'u1', attributes: {} },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty flags array', () => {
    const result = bulkEvaluateSchema.safeParse({
      flags: [],
      userContext: { id: 'u1', attributes: {} },
    });
    expect(result.success).toBe(false);
  });
});

describe('eventIngestionSchema', () => {
  it('accepts valid events', () => {
    const result = eventIngestionSchema.safeParse({
      events: [{ type: 'flag.evaluated', flagKey: 'x', timestamp: 123 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty events array', () => {
    const result = eventIngestionSchema.safeParse({ events: [] });
    expect(result.success).toBe(false);
  });

  it('rejects event missing timestamp', () => {
    const result = eventIngestionSchema.safeParse({
      events: [{ type: 'flag.evaluated' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('createSDKKeySchema', () => {
  it('accepts valid key creation', () => {
    const result = createSDKKeySchema.safeParse({ name: 'prod-key', projectId: 'proj-1' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createSDKKeySchema.safeParse({ name: '', projectId: 'proj-1' });
    expect(result.success).toBe(false);
  });
});

describe('createExperimentSchema', () => {
  it('accepts valid experiment', () => {
    const result = createExperimentSchema.safeParse({
      name: 'Timer test',
      flagKey: 'game.timer',
      metric: 'room.completed',
      variants: [
        { key: 'control', value: 8, weight: 50 },
        { key: 'treatment', value: 5, weight: 50 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects < 2 variants', () => {
    const result = createExperimentSchema.safeParse({
      name: 'Test',
      flagKey: 'x',
      metric: 'm',
      variants: [{ key: 'only', value: 1, weight: 100 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('updateExperimentSchema', () => {
  it('accepts empty object', () => {
    const result = updateExperimentSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('concludeExperimentSchema', () => {
  it('accepts valid winner', () => {
    const result = concludeExperimentSchema.safeParse({ winner: 'treatment' });
    expect(result.success).toBe(true);
  });

  it('rejects missing winner', () => {
    const result = concludeExperimentSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
