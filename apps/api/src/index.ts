import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './logger';
import { collectMetrics, metrics } from './metrics';
import flagsRouter from './routes/flags';
import sdkKeysRouter from './routes/sdk-keys';
import auditRouter from './routes/audit';
import experimentsRouter from './routes/experiments';
import evaluateRouter from './routes/evaluate';
import streamRouter from './routes/stream';
import eventsRouter from './routes/events';
import sdkFlagsRouter from './routes/sdk-flags';
import { errorHandler } from './middleware/error-handler';
import { adminAuth } from './middleware/admin-auth';
import { initVerikaObserver, verikaServiceAuth } from './middleware/api-key-auth';
import { startSubscription, stopSubscription } from './services/pubsub-service';

const app = express();

// ── Security headers ────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24h preflight cache
  }),
);

// ── Body parsing with size limits ───────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Request logging & metrics ─────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.httpRequestsTotal.inc({
      method: req.method,
      path: req.route?.path ?? req.path,
      status: String(res.statusCode),
    });
    metrics.httpRequestLatency.observe(
      { method: req.method, path: req.route?.path ?? req.path },
      duration,
    );
    logger.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
      },
      'request',
    );
  });
  next();
});

// ── Rate limiting for SDK endpoints ─────────────────────────────────────
const sdkRateLimit = rateLimit({
  windowMs: 60_000, // 1 minute
  limit: 100, // 100 requests per minute per key
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per SDK key (from Authorization header)
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return req.ip ?? 'unknown';
  },
  message: { error: 'Rate limit exceeded. Max 100 requests per minute per SDK key.' },
});

// Basic liveness — always 200 if the process is alive.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/live', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness — checks that Firestore is reachable before accepting traffic.
app.get('/health/ready', async (_req, res) => {
  try {
    const { db } = await import('./db/firestore');
    await db.listCollections();
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.warn({ err }, 'Readiness check failed');
    res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
  }
});

// ── Admin API routes (authenticated) ────────────────────────────────────
app.use('/api/flags', adminAuth, flagsRouter);
app.use('/api/sdk-keys', adminAuth, sdkKeysRouter);
app.use('/api/audit', adminAuth, auditRouter);
app.use('/api/experiments', adminAuth, experimentsRouter);

app.get('/api/auth/me', adminAuth, (req, res) => {
  res.json({ email: req.user?.email ?? null });
});

/**
 * POST /api/auth/verify — verify a caller's identity and return resolved claims.
 * Used by Verika (and other services) to validate that a token is accepted by
 * Mystweaver's configured auth provider, without needing to duplicate provider logic.
 * Returns 200 + { email, serviceAccount? } on success, 401 on failure.
 */
app.post('/api/auth/verify', adminAuth, (req, res) => {
  res.json({
    email: req.user?.email ?? null,
    serviceAccount: req.user?.serviceAccount ?? null,
  });
});

// ── Session lifecycle ─────────────────────────────────────────────────
// Used by game servers to warm up / wind down the API between sessions.

app.post('/api/session/start', adminAuth, async (_req, res) => {
  const start = Date.now();
  // Warm Firestore connection by issuing a lightweight read
  const { db } = await import('./db/firestore');
  await db.listCollections();
  res.json({ status: 'warm', bootMs: Date.now() - start });
});

app.post('/api/session/stop', adminAuth, async (_req, res) => {
  // Flush any pending state (future: flush event buffers, close SSE, etc.)
  res.json({ status: 'stopped' });
});

// ── SDK routes (Bearer auth + rate limiting) ────────────────────────────
app.use('/sdk/evaluate', sdkRateLimit, evaluateRouter);
app.use('/sdk/flags', sdkRateLimit, sdkFlagsRouter);
// SSE connections are long-lived — use a separate, generous rate limit
// to prevent connection exhaustion while allowing normal usage.
const sseRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10, // max 10 new SSE connections per minute per key
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return req.ip ?? 'unknown';
  },
  message: { error: 'Too many SSE connections. Max 10 per minute per SDK key.' },
});
app.use('/sdk/stream', sseRateLimit, streamRouter);
app.use('/sdk/events', sdkRateLimit, eventsRouter);

// ── Monitoring ──────────────────────────────────────────────────────────
app.use('/api/stream', streamRouter);

// /metrics accepts either a Verika service token (metrics.read capability) or
// the existing admin auth provider — whichever the caller presents.
const metricsAuth = (req: Request, res: Response, next: NextFunction) =>
  req.headers.authorization?.startsWith('eyJ')
    ? verikaServiceAuth('metrics.read')(req, res, next)
    : adminAuth(req, res, next);

app.get('/metrics', metricsAuth, (_req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(collectMetrics());
});

app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Mystweaver API started');
  startSubscription().catch((err) => {
    logger.warn({ err }, 'Failed to start Pub/Sub subscription');
  });
  initVerikaObserver(config.verikaEndpoint, config.verikaServiceId).catch(() => {});
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  stopSubscription()
    .then(() => server.close(() => process.exit(0)))
    .catch(() => process.exit(1));
});

export default app;
