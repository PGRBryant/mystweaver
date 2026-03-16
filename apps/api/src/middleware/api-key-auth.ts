import type { Request, Response, NextFunction } from 'express';
import { validateSDKKey } from '../services/sdk-key-service';
import { logger } from '../logger';

// ── Verika client (singleton, initialised once at startup) ────────────────────

type VerikaIdentity = {
  serviceId: string;
  tokenId: string;
  capabilities: string[];
  version: number;
  project: string;
};

type VerikaClientInstance = {
  validateServiceToken(t: string): Promise<VerikaIdentity>;
  validateHumanToken(t: string): Promise<{ userId: string; email: string; roles: string[]; tokenId: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _verika: VerikaClientInstance | null = null;

/** Returns the Verika client singleton, or null if not yet initialised. */
export function getVerikaClient(): VerikaClientInstance | null {
  return _verika;
}

/**
 * Initialise the Verika client. Call once at startup.
 * Fails gracefully if @internal/verika is not installed or misconfigured.
 */
export async function initVerika(endpoint: string, serviceId: string): Promise<void> {
  if (!endpoint || !serviceId) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('@internal/verika' as any);
    const client = new mod.VerikaClient({
      service: serviceId,
      targetService: 'verika',
      verikaEndpoint: endpoint,
    });
    await client.ready();
    _verika = client;
    logger.info({ serviceId }, 'verika:client-ready');
  } catch (err) {
    logger.warn({ err }, 'verika:client-unavailable');
  }
}

// Extend Express Request to carry both SDK and Verika context.
declare global {
  namespace Express {
    interface Request {
      sdkProjectId?: string;
      verikaTokenId?: string;
      verikaCallerService?: string;
      verikaCapabilities?: string[];
    }
  }
}

/**
 * Validates an SDK key OR a Verika-issued service token from either:
 *   1. Authorization: Bearer <token> header (preferred)
 *   2. ?apiKey=<token> query parameter (for EventSource/SSE which can't set headers)
 *
 * Auth path selection:
 *   - If the bearer value looks like a JWT (starts with "eyJ") AND Verika is
 *     available, enforce it as a Verika service token.
 *   - Otherwise fall through to SDK key validation (backwards compatible).
 *
 * On success, populates req.sdkProjectId (SDK path) or req.verikaCallerService +
 * req.verikaTokenId + req.verikaCapabilities (Verika path).
 */
export async function sdkAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  let rawToken: string | undefined;

  if (header?.startsWith('Bearer ')) {
    rawToken = header.slice(7);
  } else if (typeof req.query.apiKey === 'string' && req.query.apiKey) {
    rawToken = req.query.apiKey;
  }

  if (!rawToken) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  // ── Verika path ───────────────────────────────────────────────────────────
  if (rawToken.startsWith('eyJ') && _verika !== null) {
    try {
      const identity = await _verika.validateServiceToken(rawToken);
      req.sdkProjectId = identity.project;
      req.verikaCallerService = identity.serviceId;
      req.verikaTokenId = identity.tokenId;
      req.verikaCapabilities = identity.capabilities;
      logger.info(
        {
          serviceId: identity.serviceId,
          tokenId: identity.tokenId,
          project: identity.project,
          capabilities: identity.capabilities,
        },
        'verika:auth-allowed',
      );
      next();
      return;
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : String(err);
      logger.warn({ code }, 'verika:auth-denied');
      res.status(401).json({ error: 'Invalid or revoked Verika token' });
      return;
    }
  }

  // ── SDK key path (backwards compatible) ──────────────────────────────────
  const projectId = await validateSDKKey(rawToken);
  if (!projectId) {
    res.status(401).json({ error: 'Invalid or revoked SDK key' });
    return;
  }

  req.sdkProjectId = projectId;
  next();
}

/**
 * Returns an Express middleware that requires a valid Verika service token
 * bearing the specified capability. SDK keys are NOT accepted on these routes.
 *
 * Usage:
 *   app.get('/metrics', verikaServiceAuth('metrics.read'), handler)
 *   // or combine with a fallback:
 *   app.get('/metrics', (req, res, next) =>
 *     req.headers.authorization?.startsWith('eyJ') ? verikaServiceAuth('metrics.read')(req, res, next) : adminAuth(req, res, next)
 *   )
 */
export function verikaServiceAuth(
  capability: string,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    if (_verika === null) {
      res.status(503).json({ error: 'Verika client not initialised' });
      return;
    }

    const header = req.headers.authorization;
    const rawToken = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!rawToken) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }

    try {
      const identity = await _verika.validateServiceToken(rawToken);

      if (!identity.capabilities.includes(capability)) {
        logger.warn(
          { serviceId: identity.serviceId, required: capability, has: identity.capabilities },
          'verika:capability-denied',
        );
        res.status(403).json({ error: `Missing required capability: ${capability}` });
        return;
      }

      req.verikaCallerService = identity.serviceId;
      req.verikaTokenId = identity.tokenId;
      req.verikaCapabilities = identity.capabilities;
      logger.info(
        { serviceId: identity.serviceId, tokenId: identity.tokenId, capability },
        'verika:capability-allowed',
      );
      next();
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : String(err);
      logger.warn({ code, capability }, 'verika:auth-denied');
      res.status(401).json({ error: 'Invalid or revoked Verika token' });
    }
  };
}
