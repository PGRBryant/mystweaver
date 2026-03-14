import { Router } from 'express';
import { sdkAuth } from '../middleware/api-key-auth';
import { validateBody } from '../middleware/validate';
import { eventsCollection } from '../db/firestore';
import { logger } from '../logger';
import { metrics } from '../metrics';
import { eventIngestionSchema } from '../schemas';
import type { EventIngestionRequest, SDKEvent } from '../types/api';

const router = Router();
const MAX_EVENTS = 100;

// Per-project rolling event quota: max 5,000 events/minute across all SDK keys.
const PROJECT_QUOTA_WINDOW_MS = 60_000;
const PROJECT_QUOTA_MAX = 5_000;
const projectEventCounts = new Map<string, { count: number; windowStart: number }>();

function checkProjectQuota(projectId: string, requested: number): boolean {
  const now = Date.now();
  const entry = projectEventCounts.get(projectId);
  if (!entry || now - entry.windowStart >= PROJECT_QUOTA_WINDOW_MS) {
    projectEventCounts.set(projectId, { count: requested, windowStart: now });
    return true;
  }
  if (entry.count + requested > PROJECT_QUOTA_MAX) return false;
  entry.count += requested;
  return true;
}

// POST /sdk/events — ingest evaluation and metric events
// TODO(verika): sdkAuth will also accept Verika service tokens once api-key-auth.ts is updated.
router.post('/', sdkAuth, validateBody(eventIngestionSchema), (req, res) => {
  const projectId = req.sdkProjectId!;
  const { events } = req.body as EventIngestionRequest;

  const accepted = Math.min(events.length, MAX_EVENTS);
  const dropped = Math.max(events.length - MAX_EVENTS, 0);
  const toWrite = events.slice(0, MAX_EVENTS);

  if (!checkProjectQuota(projectId, accepted)) {
    res.status(429).json({ error: 'Project event quota exceeded. Max 5,000 events per minute.' });
    return;
  }

  metrics.eventsIngestedTotal.inc({ status: 'accepted' }, accepted);
  if (dropped > 0) {
    metrics.eventsIngestedTotal.inc({ status: 'dropped' }, dropped);
  }

  // Fire-and-forget: write to Firestore async, respond immediately.
  writeEvents(projectId, toWrite).catch((err) => {
    logger.error({ err, projectId, count: toWrite.length }, 'Async event write failed');
  });

  res.json({ accepted, dropped });
});

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
