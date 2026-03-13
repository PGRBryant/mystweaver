import { FieldValue } from '@google-cloud/firestore';
import { flagsCollection, configDoc } from '../db/firestore';
import { invalidateFlag } from './cache-service';
import { publishFlagChange } from './pubsub-service';
import { writeAuditRecord } from './audit-service';
import { AppError } from '../middleware/error-handler';
import { matchesFlagType } from '../schemas';
import type { FlagDocument } from '../types/flag';
import type { CreateFlagRequest, UpdateFlagRequest } from '../types/api';

const FLAG_KEY_RE = /^[a-z0-9][a-z0-9._-]{0,98}[a-z0-9]$/;

function validateFlagKey(key: string): void {
  if (!FLAG_KEY_RE.test(key)) {
    throw new AppError(
      'Flag key must be 2-100 chars, lowercase alphanumeric with . _ - separators',
      400,
    );
  }
}

/** Strip Firestore Timestamps for audit serialization. */
function toPlain(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v && typeof v === 'object' && 'toDate' in v) {
      out[k] = (v as { toDate: () => Date }).toDate().toISOString();
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function createFlag(
  projectId: string,
  data: CreateFlagRequest,
  performedBy = 'admin',
): Promise<FlagDocument> {
  validateFlagKey(data.key);

  const col = flagsCollection(projectId);
  const docRef = col.doc(data.key);
  const existing = await docRef.get();

  if (existing.exists) {
    throw new AppError(`Flag "${data.key}" already exists`, 409);
  }

  const now = FieldValue.serverTimestamp();
  const flagData = {
    key: data.key,
    name: data.name,
    description: data.description ?? '',
    type: data.type,
    defaultValue: data.defaultValue,
    enabled: data.enabled ?? true,
    rules: data.rules ?? [],
    tags: data.tags ?? [],
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: performedBy,
  };

  await docRef.set(flagData);
  await publishFlagChange(data.key, 'update');

  const created = await docRef.get();
  const result = { key: created.id, ...created.data() } as FlagDocument;

  // Fire-and-forget audit record + composite config rebuild.
  writeAuditRecord({
    projectId,
    action: 'flag.created',
    performedBy,
    flagKey: data.key,
    after: toPlain(created.data() as Record<string, unknown>),
  });
  rebuildFlagConfig(projectId).catch(() => {});

  return result;
}

export async function getFlag(projectId: string, key: string): Promise<FlagDocument | null> {
  const doc = await flagsCollection(projectId).doc(key).get();
  if (!doc.exists) return null;
  const data = doc.data() as FlagDocument;
  if (data.deletedAt) return null; // soft-deleted
  return { key: doc.id, ...doc.data() } as FlagDocument;
}

export async function listFlags(projectId: string): Promise<FlagDocument[]> {
  const snapshot = await flagsCollection(projectId)
    .where('deletedAt', '==', null)
    .orderBy('createdAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({ key: doc.id, ...doc.data() }) as FlagDocument);
}

export async function updateFlag(
  projectId: string,
  key: string,
  data: UpdateFlagRequest,
  performedBy = 'admin',
): Promise<FlagDocument> {
  const docRef = flagsCollection(projectId).doc(key);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new AppError(`Flag "${key}" not found`, 404);
  }

  const existingData = existing.data() as FlagDocument;
  if (existingData.deletedAt) {
    throw new AppError(`Flag "${key}" not found`, 404);
  }

  if (data.defaultValue !== undefined && !matchesFlagType(existingData.type, data.defaultValue)) {
    throw new AppError(`defaultValue must be a ${existingData.type}`, 400);
  }

  const before = toPlain(existing.data() as Record<string, unknown>);

  // Determine specific action for audit.
  let action: 'flag.updated' | 'flag.enabled' | 'flag.disabled' = 'flag.updated';
  if (data.enabled === true && !existingData.enabled) action = 'flag.enabled';
  if (data.enabled === false && existingData.enabled) action = 'flag.disabled';

  await docRef.update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await invalidateFlag(projectId, key);
  await publishFlagChange(key, 'update');

  const updated = await docRef.get();
  const result = { key: updated.id, ...updated.data() } as FlagDocument;

  writeAuditRecord({
    projectId,
    action,
    performedBy,
    flagKey: key,
    before,
    after: toPlain(updated.data() as Record<string, unknown>),
  });
  rebuildFlagConfig(projectId).catch(() => {});

  return result;
}

export async function replaceFlag(
  projectId: string,
  key: string,
  data: CreateFlagRequest,
  performedBy = 'admin',
): Promise<FlagDocument> {
  const docRef = flagsCollection(projectId).doc(key);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new AppError(`Flag "${key}" not found`, 404);
  }

  const before = toPlain(existing.data() as Record<string, unknown>);

  const now = FieldValue.serverTimestamp();
  await docRef.set({
    key,
    name: data.name,
    description: data.description ?? '',
    type: data.type,
    defaultValue: data.defaultValue,
    enabled: data.enabled ?? true,
    rules: data.rules ?? [],
    tags: data.tags ?? [],
    deletedAt: null,
    createdAt: existing.data()?.createdAt ?? now,
    updatedAt: now,
    createdBy: existing.data()?.createdBy ?? performedBy,
  });

  await invalidateFlag(projectId, key);
  await publishFlagChange(key, 'update');

  const updated = await docRef.get();
  const result = { key: updated.id, ...updated.data() } as FlagDocument;

  writeAuditRecord({
    projectId,
    action: 'flag.updated',
    performedBy,
    flagKey: key,
    before,
    after: toPlain(updated.data() as Record<string, unknown>),
  });
  rebuildFlagConfig(projectId).catch(() => {});

  return result;
}

export async function deleteFlag(
  projectId: string,
  key: string,
  performedBy = 'admin',
): Promise<void> {
  const docRef = flagsCollection(projectId).doc(key);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new AppError(`Flag "${key}" not found`, 404);
  }

  const before = toPlain(existing.data() as Record<string, unknown>);

  // Soft delete — retain for audit.
  await docRef.update({
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await invalidateFlag(projectId, key);
  await publishFlagChange(key, 'delete');

  writeAuditRecord({
    projectId,
    action: 'flag.deleted',
    performedBy,
    flagKey: key,
    before,
  });
  rebuildFlagConfig(projectId).catch(() => {});
}

// ── Composite flag config document ────────────────────────────────────

/**
 * Rebuild the composite config doc (`projects/{pid}/config/flags`).
 * Contains all active flag definitions in a single Firestore document,
 * so the SDK can fetch the entire ruleset in one read.
 */
export async function rebuildFlagConfig(projectId: string): Promise<void> {
  const snapshot = await flagsCollection(projectId)
    .where('deletedAt', '==', null)
    .get();

  const flags: Record<string, unknown> = {};
  for (const doc of snapshot.docs) {
    const data = doc.data();
    flags[doc.id] = {
      key: doc.id,
      name: data.name,
      description: data.description,
      type: data.type,
      defaultValue: data.defaultValue,
      enabled: data.enabled,
      rules: data.rules ?? [],
      tags: data.tags ?? [],
    };
  }

  await configDoc(projectId, 'flags').set({
    flags,
    flagCount: snapshot.size,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Read the composite flag config document (1 Firestore read).
 * Returns null if it doesn't exist yet (e.g., no flags created).
 */
export async function getFlagConfig(
  projectId: string,
): Promise<{ flags: Record<string, unknown>; flagCount: number; updatedAt: unknown } | null> {
  const doc = await configDoc(projectId, 'flags').get();
  if (!doc.exists) return null;
  return doc.data() as { flags: Record<string, unknown>; flagCount: number; updatedAt: unknown };
}
