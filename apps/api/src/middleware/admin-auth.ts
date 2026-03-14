import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { getAuthProvider } from './auth-providers';

// Extend Express Request to carry admin user context.
declare global {
  namespace Express {
    interface Request {
      user?: { email: string; serviceAccount?: string };
    }
  }
}

// Resolve provider once at module load.
const provider = getAuthProvider(config.authProvider);

/**
 * Admin authentication middleware.
 *
 * Delegates identity resolution to the configured AUTH_PROVIDER:
 *   google-iap  — Google IAP headers (production default)
 *   dev         — x-dev-user header / dev@localhost fallback (local only)
 *   verika      — Verika JWT verification (set AUTH_PROVIDER=verika)
 *
 * On success, sets req.user. On failure, returns 401.
 *
 * TODO(verika): When AUTH_PROVIDER=verika, this delegates to verikaProvider.resolve()
 * which currently returns null (stub). Implement verikaProvider in auth-providers.ts
 * once Verika is deployed and @internal/verika SDK is available.
 */
export async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // TODO(verika): Identity resolution point. Switch provider by setting AUTH_PROVIDER=verika.
    const identity = await provider.resolve(req);
    if (!identity) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    req.user = identity;
    next();
  } catch (err) {
    next(err);
  }
}
