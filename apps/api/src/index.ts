import express from 'express';
import { config } from './config';
import flagsRouter from './routes/flags';
import evaluateRouter from './routes/evaluate';
import { errorHandler } from './middleware/error-handler';
import { startSubscription, stopSubscription } from './services/pubsub-service';
import { closeRedis } from './db/redis';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/flags', flagsRouter);
app.use('/api/v1/evaluate', evaluateRouter);

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
