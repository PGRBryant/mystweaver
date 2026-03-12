import { Firestore } from '@google-cloud/firestore';
import { config } from '../config';

// When FIRESTORE_EMULATOR_HOST is set, the client auto-connects to the emulator.
export const db = new Firestore({
  projectId: config.gcpProjectId || 'mystweaver-local',
});

export const flagsCollection = db.collection('flags');
