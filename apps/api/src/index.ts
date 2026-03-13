import express from 'express';
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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Admin API routes (authenticated) ────────────────────────────────────
app.use('/api/flags', adminAuth, flagsRouter);
app.use('/api/sdk-keys', adminAuth, sdkKeysRouter);
app.use('/api/audit', adminAuth, auditRouter);
app.use('/api/experiments', adminAuth, experimentsRouter);

app.get('/api/auth/me', adminAuth, (req, res) => {
  res.json({ email: req.user?.email ?? null });
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
app.use('/sdk/stream', streamRouter); // SSE not rate limited (long-lived)
app.use('/sdk/events', sdkRateLimit, eventsRouter);

// ── Monitoring ──────────────────────────────────────────────────────────
app.use('/api/stream', streamRouter);

app.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(collectMetrics());
});

app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Mystweaver API started');
  startSubscription().catch(() => {});
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  stopSubscription()
    .then(() => server.close(() => process.exit(0)))
    .catch(() => process.exit(1));
});

export default app;
