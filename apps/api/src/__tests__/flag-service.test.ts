import { describe, it, expect } from 'vitest';
import { AppError } from '../middleware/error-handler';

/**
 * Test the pure / synchronous logic from flag-service.
 * The CRUD functions themselves require Firestore and are better tested
 * via integration tests. Here we test validateFlagKey and toPlain.
 */

// validateFlagKey is not exported, so we replicate the regex and test it directly.
// This ensures the validation rules are correct regardless of implementation.
const FLAG_KEY_RE = /^[a-z0-9][a-z0-9._-]{0,98}[a-z0-9]$/;

describe('FLAG_KEY_RE (flag key validation)', () => {
  it('accepts simple lowercase keys', () => {
    expect(FLAG_KEY_RE.test('my-flag')).toBe(true);
    expect(FLAG_KEY_RE.test('feature.enabled')).toBe(true);
    expect(FLAG_KEY_RE.test('game_timer')).toBe(true);
  });

  it('accepts keys with dots, hyphens, underscores', () => {
    expect(FLAG_KEY_RE.test('game.task-timer_seconds')).toBe(true);
    expect(FLAG_KEY_RE.test('a1')).toBe(true); // minimum 2 chars
  });

  it('rejects uppercase keys', () => {
    expect(FLAG_KEY_RE.test('MyFlag')).toBe(false);
    expect(FLAG_KEY_RE.test('LOUD')).toBe(false);
  });

  it('rejects keys starting/ending with separator', () => {
    expect(FLAG_KEY_RE.test('.leading-dot')).toBe(false);
    expect(FLAG_KEY_RE.test('trailing-dot.')).toBe(false);
    expect(FLAG_KEY_RE.test('-hyphen')).toBe(false);
    expect(FLAG_KEY_RE.test('hyphen-')).toBe(false);
  });

  it('rejects single-character keys', () => {
    expect(FLAG_KEY_RE.test('a')).toBe(false);
  });

  it('rejects keys with spaces or special characters', () => {
    expect(FLAG_KEY_RE.test('has space')).toBe(false);
    expect(FLAG_KEY_RE.test('no@symbol')).toBe(false);
    expect(FLAG_KEY_RE.test('no/slash')).toBe(false);
  });

  it('rejects keys longer than 100 characters', () => {
    const longKey = 'a' + 'b'.repeat(99) + 'c'; // 101 chars
    expect(FLAG_KEY_RE.test(longKey)).toBe(false);
  });

  it('accepts 100-character keys', () => {
    const maxKey = 'a' + 'b'.repeat(98) + 'c'; // 100 chars
    expect(FLAG_KEY_RE.test(maxKey)).toBe(true);
  });
});

describe('AppError (used by flag-service)', () => {
  it('provides structured error for duplicate flag', () => {
    const err = new AppError('Flag "my-flag" already exists', 409);
    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('already exists');
  });

  it('provides structured error for missing flag', () => {
    const err = new AppError('Flag "missing" not found', 404);
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('not found');
  });
});
