/**
 * Shared setup for Firestore emulator integration tests.
 *
 * Requires FIRESTORE_EMULATOR_HOST to be set (e.g. 127.0.0.1:8787).
 * The Firestore client in db/firestore.ts auto-connects to the emulator
 * when this env var is present.
 */
import { db } from '../db/firestore';

let counter = 0;

/**
 * Generate a unique project ID for each test file to prevent cross-file interference
 * when vitest runs test files in parallel.
 */
export function createTestProjectId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++counter}`;
}

/**
 * Delete all documents under a Firestore collection.
 */
async function clearCollection(path: string): Promise<void> {
  const col = db.collection(path);
  const snapshot = await col.limit(500).get();
  if (snapshot.empty) return;

  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  if (snapshot.size === 500) {
    await clearCollection(path);
  }
}

/**
 * Clean up all test data for a given project.
 */
export async function cleanupProject(projectId: string): Promise<void> {
  await Promise.all([
    clearCollection(`projects/${projectId}/flags`),
    clearCollection(`projects/${projectId}/experiments`),
    clearCollection(`projects/${projectId}/audit`),
    clearCollection(`projects/${projectId}/events`),
  ]);
}
