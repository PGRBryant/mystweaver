import { Router } from 'express';
import { sdkAuth } from '../middleware/api-key-auth';
import { validateBody } from '../middleware/validate';
import { eventsCollection } from '../db/firestore';
import type { EventIngestionRequest, SDKEvent } from '../types/api';

const router = Router();
const MAX_EVENTS = 100;

// POST /sdk/events — ingest evaluation and metric events
router.post(
  '/',
  sdkAuth,
  validateBody({ events: 'array' }),
  (req, res) => {
    const projectId = req.sdkProjectId!;
    const { events } = req.body as EventIngestionRequest;

    const accepted = Math.min(events.length, MAX_EVENTS);
    const dropped = Math.max(events.length - MAX_EVENTS, 0);
    const toWrite = events.slice(0, MAX_EVENTS);

    // Fire-and-forget: write to Firestore async, respond immediately.
    writeEvents(projectId, toWrite).catch((err) => {
      console.error('[events] async write failed:', err);
    });

    res.json({ accepted, dropped });
  },
);

async function writeEvents(projectId: string, events: SDKEvent[]): Promise<void> {
  const col = eventsCollection(projectId);
  const BATCH_SIZE = 500; // Firestore batch limit

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const chunk = events.slice(i, i + BATCH_SIZE);
    const batch = col.firestore.batch();

    for (const event of chunk) {
      const ref = col.doc();
      batch.set(ref, {
        ...event,
        projectId,
        ingestedAt: Date.now(),
      });
    }

    await batch.commit();
  }
}

export default router;
