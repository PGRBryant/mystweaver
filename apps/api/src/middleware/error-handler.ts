import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';
import { metrics } from '../metrics';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  metrics.httpErrorsTotal.inc({ status: String(statusCode), method: req.method, path: req.path });

  if (statusCode >= 500) {
    logger.error({ err, method: req.method, path: req.path }, 'Unhandled server error');
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : err.message,
  });
}
