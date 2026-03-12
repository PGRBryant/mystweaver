import express from 'express';
import { config } from './config';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Feature flag routes will be registered here as they are implemented:
// app.use('/api/v1/flags', flagsRouter);

const server = app.listen(config.port, () => {
  console.log(`[mystweaver-api] listening on port ${config.port}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
