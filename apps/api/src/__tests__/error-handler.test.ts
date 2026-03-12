import { describe, it, expect, vi } from 'vitest';
import { AppError, errorHandler } from '../middleware/error-handler';
import type { Request, Response, NextFunction } from 'express';

// Suppress logger output during tests.
vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Stub metrics so we don't pollute the real registry.
vi.mock('../metrics', () => ({
  metrics: { httpErrorsTotal: { inc: vi.fn() } },
}));

function mockReq(overrides: Partial<Request> = {}): Request {
  return { method: 'GET', path: '/test', ...overrides } as unknown as Request;
}

function mockRes(): Response & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: undefined as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _body: unknown };
}

const noop: NextFunction = () => {};

describe('AppError', () => {
  it('has name, message, and statusCode', () => {
    const err = new AppError('Not found', 404);
    expect(err.name).toBe('AppError');
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err).toBeInstanceOf(Error);
  });

  it('defaults statusCode to 500', () => {
    const err = new AppError('boom');
    expect(err.statusCode).toBe(500);
  });
});

describe('errorHandler', () => {
  it('returns AppError message for 4xx errors', () => {
    const err = new AppError('Flag not found', 404);
    const res = mockRes();
    errorHandler(err, mockReq(), res, noop);
    expect(res._status).toBe(404);
    expect(res._body).toEqual({ error: 'Flag not found' });
  });

  it('hides message for 500+ errors', () => {
    const err = new Error('secret crash details');
    const res = mockRes();
    errorHandler(err, mockReq(), res, noop);
    expect(res._status).toBe(500);
    expect(res._body).toEqual({ error: 'Internal server error' });
  });

  it('uses AppError statusCode for 5xx AppErrors', () => {
    const err = new AppError('service unavailable', 503);
    const res = mockRes();
    errorHandler(err, mockReq(), res, noop);
    expect(res._status).toBe(503);
    expect(res._body).toEqual({ error: 'Internal server error' });
  });
});
