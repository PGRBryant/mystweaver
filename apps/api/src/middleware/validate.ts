import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import { AppError } from './error-handler';

/**
 * Validate request body against a Zod schema.
 * On success, replaces `req.body` with the parsed (and stripped) value.
 * On failure, throws a 400 AppError with human-readable field errors.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const messages = formatZodError(result.error);
      throw new AppError(messages, 400);
    }

    req.body = result.data;
    next();
  };
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'body';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}
