import express from 'express';

const app = express();
const port = Number(process.env['PORT'] ?? 3000);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Feature flag routes will be registered here as they are implemented:
// app.use('/api/v1/flags', flagsRouter);

const server = app.listen(port, () => {
  console.log(`[mystweaver-api] listening on port ${port}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
