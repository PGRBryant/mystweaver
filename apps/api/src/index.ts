import express from 'express';
import { config } from './config';
import flagsRouter from './routes/flags';
import sdkKeysRouter from './routes/sdk-keys';
import auditRouter from './routes/audit';
import experimentsRouter from './routes/experiments';
import evaluateRouter from './routes/evaluate';
import streamRouter from './routes/stream';
import eventsRouter from './routes/events';
import { errorHandler } from './middleware/error-handler';
import { adminAuth } from './middleware/admin-auth';
import { startSubscription, stopSubscription } from './services/pubsub-service';
import { closeRedis } from './db/redis';

const app = express();

app.use(express.json());

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

// ── SDK routes (Bearer auth) ────────────────────────────────────────────
app.use('/sdk/evaluate', evaluateRouter);
app.use('/sdk/stream', streamRouter);
app.use('/sdk/events', eventsRouter);

// ── Monitoring ──────────────────────────────────────────────────────────
app.use('/api/stream', streamRouter);

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[mystweaver-api] listening on port ${config.port}`);
  startSubscription().catch(() => {});
});

process.on('SIGTERM', () => {
  stopSubscription()
    .then(() => closeRedis())
    .then(() => server.close(() => process.exit(0)))
    .catch(() => process.exit(1));
});

export default app;
