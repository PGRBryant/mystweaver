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
 * Validates Authorization: Bearer <sdk-key> header.
 * On success, sets req.sdkProjectId to the key's projectId.
 */
export async function sdkAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const rawKey = header.slice(7);
  const projectId = await validateSDKKey(rawKey);

  if (!projectId) {
    res.status(401).json({ error: 'Invalid or revoked SDK key' });
    return;
  }

  req.sdkProjectId = projectId;
  next();
}
