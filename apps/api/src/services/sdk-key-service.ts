import { createHash, randomBytes } from 'crypto';
import { FieldValue } from '@google-cloud/firestore';
import { sdkKeysCollection } from '../db/firestore';
import { AppError } from '../middleware/error-handler';
import type { SDKKeyDocument, SDKKeyMetadata, CreateSDKKeyRequest } from '../types/sdk-key';

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function toMetadata(doc: SDKKeyDocument): SDKKeyMetadata {
  return {
    id: doc.id,
    name: doc.name,
    projectId: doc.projectId,
    createdAt: doc.createdAt?.toDate?.().toISOString() ?? '',
    lastUsedAt: doc.lastUsedAt?.toDate?.().toISOString() ?? null,
    revokedAt: doc.revokedAt?.toDate?.().toISOString() ?? null,
  };
}

/**
 * Create a new SDK key. Returns { metadata, rawKey }.
 * rawKey is only available at creation time.
 */
export async function createSDKKey(
  data: CreateSDKKeyRequest,
): Promise<{ metadata: SDKKeyMetadata; rawKey: string }> {
  const rawKey = `mw_sdk_${randomBytes(24).toString('hex')}`;
  const hashed = hashKey(rawKey);
  const id = `key_${randomBytes(8).toString('hex')}`;

  const docData = {
    id,
    name: data.name,
    projectId: data.projectId,
    hashedKey: hashed,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
    revokedAt: null,
  };

  await sdkKeysCollection.doc(id).set(docData);

  // Re-read to get resolved timestamp.
  const created = await sdkKeysCollection.doc(id).get();
  const metadata = toMetadata({ id, ...created.data() } as SDKKeyDocument);

  return { metadata, rawKey };
}

/**
 * List all SDK keys (metadata only — never returns raw key values).
 */
export async function listSDKKeys(): Promise<SDKKeyMetadata[]> {
  const snapshot = await sdkKeysCollection.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => toMetadata({ id: doc.id, ...doc.data() } as SDKKeyDocument));
}

/**
 * Revoke a key immediately by setting revokedAt.
 */
export async function revokeSDKKey(keyId: string): Promise<void> {
  const ref = sdkKeysCollection.doc(keyId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new AppError(`SDK key "${keyId}" not found`, 404);
  }

  await ref.update({ revokedAt: FieldValue.serverTimestamp() });
}

/**
 * Validate a raw Bearer token against hashed keys.
 * Returns the projectId if valid, null if invalid/revoked.
 */
export async function validateSDKKey(rawKey: string): Promise<string | null> {
  const hashed = hashKey(rawKey);

  const snapshot = await sdkKeysCollection.where('hashedKey', '==', hashed).limit(1).get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0].data() as SDKKeyDocument;

  // Revoked keys are permanently invalid.
  if (doc.revokedAt) return null;

  // Update lastUsedAt (fire-and-forget).
  sdkKeysCollection
    .doc(doc.id)
    .update({
      lastUsedAt: FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return doc.projectId;
}
