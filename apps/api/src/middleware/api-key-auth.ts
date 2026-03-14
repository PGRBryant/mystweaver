import type { Request, Response, NextFunction } from 'express';
import { validateSDKKey } from '../services/sdk-key-service';
import { logger } from '../logger';

// ── Verika observation mode ───────────────────────────────────────────────────
// Shadow-validates incoming tokens so we can observe what Verika would decide
// before enforcement is turned on. Never changes actual auth outcome.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _verikaObserver: { validateServiceToken(t: string): Promise<{ serviceId: string }> } | null =
  null;

/**
 * Initialize the Verika observer. Call once at startup.
 * Fails gracefully if @internal/verika is not installed or misconfigured.
 */
export async function initVerikaObserver(endpoint: string, serviceId: string): Promise<void> {
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
    _verikaObserver = client;
    logger.info({ serviceId }, 'verika:observer-ready');
  } catch (err) {
    logger.warn({ err }, 'verika:observer-unavailable');
  }
}

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
 *
 * TODO(verika): Phase 1 — also accept a Verika-issued service token here.
 * When a consuming service (e.g. Room 404) presents a Verika identity token
 * instead of a raw SDK key, validate it via @internal/verika and derive the
 * projectId from the token's service claims rather than the sdk-keys collection.
 * The fallback (SDK key path) remains unchanged for backwards compatibility.
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

  // Observation mode: shadow-validate Verika JWTs without changing auth behavior.
  if (rawKey.startsWith('eyJ') && _verikaObserver !== null) {
    _verikaObserver
      .validateServiceToken(rawKey)
      .then((identity) =>
        logger.info({ serviceId: identity.serviceId, mode: 'observation' }, 'verika:shadow-allow'),
      )
      .catch((err: Error) =>
        logger.info({ code: err.message, mode: 'observation' }, 'verika:shadow-deny'),
      );
  }

  const projectId = await validateSDKKey(rawKey);

  if (!projectId) {
    res.status(401).json({ error: 'Invalid or revoked SDK key' });
    return;
  }

  req.sdkProjectId = projectId;
  next();
}
