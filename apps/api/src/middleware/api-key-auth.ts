import type { Request, Response, NextFunction } from 'express';
import { validateSDKKey } from '../services/sdk-key-service';

// Extend Express Request to carry SDK context.
declare global {
  namespace Express {
    interface Request {
      sdkProjectId?: string;
    }
  }
}

/**
 * Validates an SDK key from either:
 *   1. Authorization: Bearer <sdk-key> header (preferred)
 *   2. ?apiKey=<sdk-key> query parameter (for EventSource/SSE which can't set headers)
 *
 * On success, sets req.sdkProjectId to the key's projectId.
 */
export async function sdkAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  let rawKey: string | undefined;

  if (header?.startsWith('Bearer ')) {
    rawKey = header.slice(7);
  } else if (typeof req.query.apiKey === 'string' && req.query.apiKey) {
    rawKey = req.query.apiKey;
  }

  if (!rawKey) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const projectId = await validateSDKKey(rawKey);

  if (!projectId) {
    res.status(401).json({ error: 'Invalid or revoked SDK key' });
    return;
  }

  req.sdkProjectId = projectId;
  next();
}
