export type AuditAction =
  | 'flag.created'
  | 'flag.updated'
  | 'flag.deleted'
  | 'flag.enabled'
  | 'flag.disabled'
  | 'sdk-key.created'
  | 'sdk-key.revoked'
  | 'experiment.started'
  | 'experiment.stopped';

export interface AuditRecord {
  id: string;
  action: AuditAction;
  projectId: string;
  flagKey?: string;
  before?: unknown;
  after?: unknown;
  performedBy: string;
  performedAt: string; // ISO string from API serialization
}
