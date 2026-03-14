/**
 * Pluggable authentication provider interface.
 *
 * Each provider resolves an HTTP request to a user identity (email + optional
 * service account). `adminAuth` in admin-auth.ts delegates to whichever
 * provider is configured via AUTH_PROVIDER env var.
 *
 * Built-in providers:
 *   google-iap  — Google Identity-Aware Proxy (default, production)
 *   dev         — Trust x-dev-user header (local development only)
 *
 * To plug in Verika:
 *   1. Set AUTH_PROVIDER=verika in environment / Terraform.
 *   2. Implement VerikAuthProvider below using the Verika SDK / JWT verification.
 */

import type { Request } from 'express';

export interface AuthIdentity {
  email: string;
  /** Set when the caller is a service account rather than an end user. */
  serviceAccount?: string;
}

export interface AuthProvider {
  /** Resolve the request to an identity, or return null if unauthenticated. */
  resolve(req: Request): Promise<AuthIdentity | null> | AuthIdentity | null;
}

// ── Google IAP provider ───────────────────────────────────────────────────────

export const googleIapProvider: AuthProvider = {
  resolve(req) {
    const iapEmail = req.headers['x-goog-authenticated-user-email'];
    if (!iapEmail || typeof iapEmail !== 'string') return null;
    const email = iapEmail.replace(/^accounts\.google\.com:/, '');
    if (!email) return null;
    return { email };
  },
};

// ── Dev provider (local only) ─────────────────────────────────────────────────

export const devProvider: AuthProvider = {
  resolve(req) {
    const devUser = req.headers['x-dev-user'];
    const email = typeof devUser === 'string' && devUser ? devUser : 'dev@localhost';
    return { email };
  },
};

// ── Verika provider stub ──────────────────────────────────────────────────────
// Activate by setting AUTH_PROVIDER=verika.
// Replace the stub body with real JWT verification once Verika is deployed.

export const verikaProvider: AuthProvider = {
  // TODO(verika): Auth decision point. Replace this stub with real JWT verification:
  //   import { createVerikaVerifier } from '@internal/verika';
  //   const verifier = createVerikaVerifier({
  //     endpoint: config.verikaEndpoint,
  //     serviceId: config.verikaServiceId,
  //     audience: config.verikaAudience,
  //   });
  //   const token = req.headers.authorization?.replace(/^Bearer /, '');
  //   const claims = await verifier.verify(token);
  //   return claims ? { email: claims.sub, serviceAccount: claims.service_account } : null;
  resolve(_req) {
    // TODO(verika): Stub — always returns null until @internal/verika is wired in.
    return null;
  },
};

// ── Provider registry ─────────────────────────────────────────────────────────

const providers: Record<string, AuthProvider> = {
  'google-iap': googleIapProvider,
  dev: devProvider,
  verika: verikaProvider,
};

export function getAuthProvider(name: string): AuthProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown AUTH_PROVIDER: "${name}". Valid options: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}
