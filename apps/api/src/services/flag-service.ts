import { FieldValue } from '@google-cloud/firestore';
import { flagsCollection } from '../db/firestore';
import { invalidateFlag } from './cache-service';
import { publishFlagChange } from './pubsub-service';
import { AppError } from '../middleware/error-handler';
import type { FlagDocument } from '../types/flag';
import type { CreateFlagRequest, UpdateFlagRequest } from '../types/api';

export async function createFlag(data: CreateFlagRequest): Promise<FlagDocument> {
  const docRef = flagsCollection.doc(data.key);
  const existing = await docRef.get();

  if (existing.exists) {
    throw new AppError(`Flag "${data.key}" already exists`, 409);
  }

  const now = FieldValue.serverTimestamp();
  const flagData = {
    key: data.key,
    name: data.name,
    description: data.description ?? '',
    enabled: data.enabled ?? true,
    type: data.type,
    defaultValue: data.defaultValue,
    rules: data.rules ?? [],
    createdAt: now,
    updatedAt: now,
    createdBy: 'admin', // TODO: extract from IAP identity header
  };

  await docRef.set(flagData);
  await publishFlagChange(data.key, 'update');

  const created = await docRef.get();
  return { key: created.id, ...created.data() } as FlagDocument;
}

export async function getFlag(key: string): Promise<FlagDocument | null> {
  const doc = await flagsCollection.doc(key).get();
  if (!doc.exists) return null;
  return { key: doc.id, ...doc.data() } as FlagDocument;
}

export async function listFlags(): Promise<FlagDocument[]> {
  const snapshot = await flagsCollection.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => ({ key: doc.id, ...doc.data() }) as FlagDocument);
}

export async function updateFlag(
  key: string,
  data: UpdateFlagRequest,
): Promise<FlagDocument> {
  const docRef = flagsCollection.doc(key);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new AppError(`Flag "${key}" not found`, 404);
  }

  await docRef.update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await invalidateFlag(key);
  await publishFlagChange(key, 'update');

  const updated = await docRef.get();
  return { key: updated.id, ...updated.data() } as FlagDocument;
}

export async function deleteFlag(key: string): Promise<void> {
  const docRef = flagsCollection.doc(key);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new AppError(`Flag "${key}" not found`, 404);
  }

  await docRef.delete();
  await invalidateFlag(key);
  await publishFlagChange(key, 'delete');
}
