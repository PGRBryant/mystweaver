import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';

type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface FieldSpec {
  type: FieldType;
  required?: boolean;
}

type Schema = Record<string, FieldSpec | FieldType>;

function normalizeSpec(spec: FieldSpec | FieldType): FieldSpec {
  return typeof spec === 'string' ? { type: spec, required: true } : spec;
}

function checkType(value: unknown, type: FieldType): boolean {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
  return typeof value === type;
}

export function validateBody(schema: Schema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const body = req.body as Record<string, unknown>;
    const errors: string[] = [];

    for (const [field, rawSpec] of Object.entries(schema)) {
      const spec = normalizeSpec(rawSpec);
      const value = body[field];

      if (value === undefined || value === null) {
        if (spec.required !== false) {
          errors.push(`${field} is required`);
        }
        continue;
      }

      if (!checkType(value, spec.type)) {
        errors.push(`${field} must be of type ${spec.type}`);
      }
    }

    if (errors.length > 0) {
      throw new AppError(errors.join('; '), 400);
    }

    next();
  };
}
