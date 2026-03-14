import { FieldValue, Query, Timestamp } from '@google-cloud/firestore';
import { auditCollection } from '../db/firestore';
import { logger } from '../logger';
import type { AuditAction, AuditRecord } from '../types/audit';

interface WriteAuditParams {
  projectId: string;
  action: AuditAction;
  performedBy: string;
  flagKey?: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Write an immutable audit record. Fire-and-forget — errors are logged
 * but never block the calling operation.
 */
export async function writeAuditRecord(params: WriteAuditParams): Promise<void> {
  try {
    const col = auditCollection(params.projectId);
    await col.add({
      action: params.action,
      projectId: params.projectId,
      flagKey: params.flagKey ?? null,
      before: params.before ?? null,
      after: params.after ?? null,
      performedBy: params.performedBy,
      performedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.error(
      { err, action: params.action, flagKey: params.flagKey },
      'Failed to write audit record',
    );
  }
}

export interface ListAuditParams {
  projectId: string;
  flagKey?: string;
  action?: AuditAction;
  performedBy?: string;
  limit?: number;
  /** ISO-8601 timestamp of the last record on the previous page (cursor-based pagination). */
  before?: string;
}

/**
 * List audit records with optional filters. Returns newest first.
 * Uses cursor-based pagination via `before` (ISO timestamp of last seen record).
 */
export async function listAuditRecords(params: ListAuditParams): Promise<AuditRecord[]> {
  let query = auditCollection(params.projectId).orderBy('performedAt', 'desc') as Query;

  if (params.flagKey) {
    query = query.where('flagKey', '==', params.flagKey);
  }
  if (params.action) {
    query = query.where('action', '==', params.action);
  }
  if (params.performedBy) {
    query = query.where('performedBy', '==', params.performedBy);
  }

  if (params.before) {
    const cursorDate = new Date(params.before);
    if (!isNaN(cursorDate.getTime())) {
      query = query.startAfter(Timestamp.fromDate(cursorDate));
    }
  }

  const limit = Math.min(params.limit ?? 50, 200);
  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AuditRecord);
}
