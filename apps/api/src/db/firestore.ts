import { Firestore } from '@google-cloud/firestore';
import { config } from '../config';

// When FIRESTORE_EMULATOR_HOST is set, the client auto-connects to the emulator.
export const db = new Firestore({
  projectId: config.gcpProjectId || 'mystweaver-local',
});

// ── Multi-project helpers ───────────────────────────────────────────────

export function flagsCollection(projectId: string) {
  return db.collection(`projects/${projectId}/flags`);
}

export function eventsCollection(projectId: string) {
  return db.collection(`projects/${projectId}/events`);
}

export function auditCollection(projectId: string) {
  return db.collection(`projects/${projectId}/audit`);
}

export function experimentsCollection(projectId: string) {
  return db.collection(`projects/${projectId}/experiments`);
}

// ── Global collections ──────────────────────────────────────────────────

export const sdkKeysCollection = db.collection('sdk-keys');
