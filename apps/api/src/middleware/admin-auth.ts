import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// Extend Express Request to carry admin user context.
declare global {
  namespace Express {
    interface Request {
      user?: { email: string };
    }
  }
}

/**
 * Admin authentication middleware.
 *
 * Production: reads Google IAP headers set by the IAP proxy.
 *   - `x-goog-authenticated-user-email` contains "accounts.google.com:<email>"
 *   - IAP validates the JWT before forwarding, so we trust the header.
 *
 * Local dev: accepts `x-dev-user` header or falls back to "dev@localhost".
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  if (config.nodeEnv === 'production') {
    const iapEmail = req.headers['x-goog-authenticated-user-email'];

    if (!iapEmail || typeof iapEmail !== 'string') {
      res.status(401).json({ error: 'Unauthenticated: missing IAP headers' });
      return;
    }

    // IAP prefixes with "accounts.google.com:" — strip it.
    const email = iapEmail.replace(/^accounts\.google\.com:/, '');
    req.user = { email };
  } else {
    // Local dev: trust x-dev-user header or fall back to dev identity.
    const devUser = req.headers['x-dev-user'];
    const email = typeof devUser === 'string' && devUser ? devUser : 'dev@localhost';
    req.user = { email };
  }

  next();
}
