import type { Flag, CreateFlagData, UpdateFlagData, EvaluateResult } from '@/types/flag';
import type { AuditRecord } from '@/types/audit';
import type { Experiment, ExperimentResults, ExperimentVariant } from '@/types/experiment';

const BASE = '/api';

// Default project for the admin UI. In Phase 2 this will come from auth context.
const DEFAULT_PROJECT = 'room-404';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

function withProject(path: string, projectId = DEFAULT_PROJECT): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}projectId=${encodeURIComponent(projectId)}`;
}

export function fetchFlags(): Promise<Flag[]> {
  return request<Flag[]>(withProject('/flags'));
}

export function fetchFlag(key: string): Promise<Flag> {
  return request<Flag>(withProject(`/flags/${encodeURIComponent(key)}`));
}

export function createFlag(data: CreateFlagData): Promise<Flag> {
  return request<Flag>(withProject('/flags'), {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateFlag(key: string, data: UpdateFlagData): Promise<Flag> {
  return request<Flag>(withProject(`/flags/${encodeURIComponent(key)}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteFlag(key: string): Promise<void> {
  return request<void>(withProject(`/flags/${encodeURIComponent(key)}`), {
    method: 'DELETE',
  });
}

export function evaluateFlag(
  flagKey: string,
  context: Record<string, unknown>,
): Promise<EvaluateResult> {
  return request<EvaluateResult>('/evaluate', {
    method: 'POST',
    body: JSON.stringify({
      flagKey,
      userContext: { id: 'preview', attributes: context },
    }),
  });
}

// ── Audit ────────────────────────────────────────────────────────────────

export interface AuditQueryParams {
  flagKey?: string;
  action?: string;
  performedBy?: string;
  limit?: number;
}

export function fetchAuditRecords(params: AuditQueryParams = {}): Promise<AuditRecord[]> {
  const qs = new URLSearchParams();
  qs.set('projectId', DEFAULT_PROJECT);
  if (params.flagKey) qs.set('flagKey', params.flagKey);
  if (params.action) qs.set('action', params.action);
  if (params.performedBy) qs.set('performedBy', params.performedBy);
  if (params.limit) qs.set('limit', String(params.limit));
  return request<AuditRecord[]>(`/audit?${qs.toString()}`);
}

export function auditExportUrl(params: AuditQueryParams = {}): string {
  const qs = new URLSearchParams();
  qs.set('projectId', DEFAULT_PROJECT);
  if (params.flagKey) qs.set('flagKey', params.flagKey);
  if (params.action) qs.set('action', params.action);
  if (params.performedBy) qs.set('performedBy', params.performedBy);
  return `${BASE}/audit/export?${qs.toString()}`;
}

// ── Experiments ──────────────────────────────────────────────────────────

export interface CreateExperimentData {
  name: string;
  flagKey: string;
  variants: ExperimentVariant[];
  metric: string;
}

export function fetchExperiments(): Promise<Experiment[]> {
  return request<Experiment[]>(withProject('/experiments'));
}

export function fetchExperiment(id: string): Promise<Experiment> {
  return request<Experiment>(withProject(`/experiments/${encodeURIComponent(id)}`));
}

export function createExperiment(data: CreateExperimentData): Promise<Experiment> {
  return request<Experiment>(withProject('/experiments'), {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateExperiment(
  id: string,
  data: Partial<CreateExperimentData>,
): Promise<Experiment> {
  return request<Experiment>(withProject(`/experiments/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteExperiment(id: string): Promise<void> {
  return request<void>(withProject(`/experiments/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });
}

export function startExperiment(id: string): Promise<Experiment> {
  return request<Experiment>(withProject(`/experiments/${encodeURIComponent(id)}/start`), {
    method: 'POST',
  });
}

export function stopExperiment(id: string): Promise<Experiment> {
  return request<Experiment>(withProject(`/experiments/${encodeURIComponent(id)}/stop`), {
    method: 'POST',
  });
}

export function concludeExperiment(id: string, winner: string): Promise<Experiment> {
  return request<Experiment>(withProject(`/experiments/${encodeURIComponent(id)}/conclude`), {
    method: 'POST',
    body: JSON.stringify({ winner }),
  });
}

export function fetchExperimentResults(id: string): Promise<ExperimentResults> {
  return request<ExperimentResults>(withProject(`/experiments/${encodeURIComponent(id)}/results`));
}

// ── Auth ─────────────────────────────────────────────────────────────────

export function fetchCurrentUser(): Promise<{ email: string | null }> {
  return request<{ email: string | null }>('/auth/me');
}
