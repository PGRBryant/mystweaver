import { Router } from 'express';
import { sdkAuth } from '../middleware/api-key-auth';
import { flagsCollection } from '../db/firestore';
import type { FlagDocument } from '../types/flag';

const router = Router();

// Track active connections for monitoring.
let activeConnections = 0;

// GET /sdk/stream — Server-Sent Events for real-time flag updates
router.get('/', sdkAuth, (req, res) => {
  const projectId = req.sdkProjectId!;

  // Set SSE headers.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  activeConnections++;

  // Firestore onSnapshot listener for real-time flag changes.
  const unsubscribe = flagsCollection(projectId)
    .where('deletedAt', '==', null)
    .onSnapshot(
      (snapshot) => {
        // Build current flags map.
        const flags: Record<string, { value: unknown; type: string; enabled: boolean }> = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data() as FlagDocument;
          flags[data.key] = {
            value: data.enabled ? data.defaultValue : data.defaultValue,
            type: data.type,
            enabled: data.enabled,
          };
        });

        // Check if this is a docChange or initial snapshot.
        const changes = snapshot.docChanges();
        if (changes.length === snapshot.docs.length && changes.every((c) => c.type === 'added')) {
          // Initial snapshot — send all flags.
          res.write(`data: ${JSON.stringify({ type: 'snapshot', flags })}\n\n`);
        } else {
          // Incremental changes.
          for (const change of changes) {
            if (change.type === 'removed') continue;
            const data = change.doc.data() as FlagDocument;
            const oldData = change.type === 'modified' ? change.doc.data() : undefined;
            res.write(
              `data: ${JSON.stringify({
                type: 'flag.updated',
                flagKey: data.key,
                value: data.defaultValue,
                previousValue: oldData?.defaultValue,
                updatedAt: Math.floor(Date.now() / 1000),
              })}\n\n`,
            );
          }
        }
      },
      (err) => {
        console.error('[sse] Firestore listener error:', err.message);
        res.end();
      },
    );

  // Keepalive ping every 30 seconds.
  const pingInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
  }, 30_000);

  // Clean up on disconnect.
  req.on('close', () => {
    activeConnections--;
    unsubscribe();
    clearInterval(pingInterval);
  });
});

// GET /api/stream/connections — monitoring endpoint
router.get('/connections', (_req, res) => {
  res.json({ activeConnections });
});

export default router;
