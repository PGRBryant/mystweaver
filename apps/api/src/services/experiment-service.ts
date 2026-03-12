import { FieldValue } from '@google-cloud/firestore';
import { experimentsCollection, flagsCollection } from '../db/firestore';
import { writeAuditRecord } from './audit-service';
import { invalidateFlag } from './cache-service';
import { publishFlagChange } from './pubsub-service';
import { AppError } from '../middleware/error-handler';
import type {
  ExperimentDocument,
  CreateExperimentRequest,
  UpdateExperimentRequest,
  ExperimentVariant,
} from '../types/experiment';
import type { FlagDocument, TargetingRule } from '../types/flag';

// ── Helpers ──────────────────────────────────────────────────────────────

function validateVariants(variants: ExperimentVariant[]): void {
  if (!variants || variants.length < 2) {
    throw new AppError('At least 2 variants are required', 400);
  }
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight !== 100) {
    throw new AppError(`Variant weights must sum to 100 (got ${totalWeight})`, 400);
  }
  const keys = new Set(variants.map((v) => v.key));
  if (keys.size !== variants.length) {
    throw new AppError('Variant keys must be unique', 400);
  }
}

/** Build targeting rules that split traffic by variant weights. */
function buildExperimentRules(
  experimentId: string,
  variants: ExperimentVariant[],
): TargetingRule[] {
  const rules: TargetingRule[] = [];
  let cumulativePercent = 0;

  for (const variant of variants) {
    cumulativePercent += variant.weight;
    rules.push({
      id: `experiment:${experimentId}:${variant.key}`,
      description: `Experiment ${experimentId} — variant "${variant.key}"`,
      conditions: [], // No conditions — applies to everyone via rollout
      value: variant.value,
      rolloutPercentage: cumulativePercent,
    });
  }

  return rules;
}

// ── CRUD ─────────────────────────────────────────────────────────────────

export async function createExperiment(
  projectId: string,
  data: CreateExperimentRequest,
  performedBy: string,
): Promise<ExperimentDocument> {
  validateVariants(data.variants);

  // Verify the flag exists.
  const flagDoc = await flagsCollection(projectId).doc(data.flagKey).get();
  if (!flagDoc.exists) {
    throw new AppError(`Flag "${data.flagKey}" not found`, 404);
  }

  const col = experimentsCollection(projectId);
  const docRef = col.doc(); // auto-generate ID
  const now = FieldValue.serverTimestamp();

  const experimentData = {
    id: docRef.id,
    name: data.name,
    flagKey: data.flagKey,
    variants: data.variants,
    metric: data.metric,
    status: 'draft' as const,
    startedAt: null,
    stoppedAt: null,
    concludedAt: null,
    winner: null,
    previousFlagState: null,
    createdBy: performedBy,
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(experimentData);
  const created = await docRef.get();
  return { id: created.id, ...created.data() } as ExperimentDocument;
}

export async function getExperiment(
  projectId: string,
  id: string,
): Promise<ExperimentDocument | null> {
  const doc = await experimentsCollection(projectId).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ExperimentDocument;
}

export async function listExperiments(projectId: string): Promise<ExperimentDocument[]> {
  const snapshot = await experimentsCollection(projectId).orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ExperimentDocument);
}

export async function updateExperiment(
  projectId: string,
  id: string,
  data: UpdateExperimentRequest,
  _performedBy: string,
): Promise<ExperimentDocument> {
  const docRef = experimentsCollection(projectId).doc(id);
  const existing = await docRef.get();
  if (!existing.exists) throw new AppError(`Experiment "${id}" not found`, 404);

  const exp = existing.data() as ExperimentDocument;
  if (exp.status !== 'draft') {
    throw new AppError('Only draft experiments can be edited', 400);
  }

  if (data.variants) validateVariants(data.variants);

  await docRef.update({ ...data, updatedAt: FieldValue.serverTimestamp() });
  const updated = await docRef.get();
  return { id: updated.id, ...updated.data() } as ExperimentDocument;
}

export async function deleteExperiment(projectId: string, id: string): Promise<void> {
  const docRef = experimentsCollection(projectId).doc(id);
  const existing = await docRef.get();
  if (!existing.exists) throw new AppError(`Experiment "${id}" not found`, 404);

  const exp = existing.data() as ExperimentDocument;
  if (exp.status !== 'draft') {
    throw new AppError('Only draft experiments can be deleted', 400);
  }

  await docRef.delete();
}

// ── Lifecycle ────────────────────────────────────────────────────────────

export async function startExperiment(
  projectId: string,
  id: string,
  performedBy: string,
): Promise<ExperimentDocument> {
  const docRef = experimentsCollection(projectId).doc(id);
  const existing = await docRef.get();
  if (!existing.exists) throw new AppError(`Experiment "${id}" not found`, 404);

  const exp = existing.data() as ExperimentDocument;
  if (exp.status !== 'draft') {
    throw new AppError(`Cannot start experiment in "${exp.status}" state`, 400);
  }

  // Snapshot current flag state so we can revert on stop.
  const flagDocRef = flagsCollection(projectId).doc(exp.flagKey);
  const flagSnap = await flagDocRef.get();
  if (!flagSnap.exists) {
    throw new AppError(`Flag "${exp.flagKey}" not found`, 404);
  }
  const flagData = flagSnap.data() as FlagDocument;

  const previousFlagState = {
    rules: flagData.rules,
    defaultValue: flagData.defaultValue,
    enabled: flagData.enabled,
  };

  // Build experiment rules and apply to the flag.
  const experimentRules = buildExperimentRules(id, exp.variants);

  await flagDocRef.update({
    rules: experimentRules,
    enabled: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await docRef.update({
    status: 'running',
    startedAt: FieldValue.serverTimestamp(),
    previousFlagState,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await invalidateFlag(projectId, exp.flagKey);
  await publishFlagChange(exp.flagKey, 'update');

  writeAuditRecord({
    projectId,
    action: 'experiment.started',
    performedBy,
    flagKey: exp.flagKey,
    after: { experimentId: id, name: exp.name, variants: exp.variants },
  });

  const updated = await docRef.get();
  return { id: updated.id, ...updated.data() } as ExperimentDocument;
}

export async function stopExperiment(
  projectId: string,
  id: string,
  performedBy: string,
): Promise<ExperimentDocument> {
  const docRef = experimentsCollection(projectId).doc(id);
  const existing = await docRef.get();
  if (!existing.exists) throw new AppError(`Experiment "${id}" not found`, 404);

  const exp = existing.data() as ExperimentDocument;
  if (exp.status !== 'running') {
    throw new AppError(`Cannot stop experiment in "${exp.status}" state`, 400);
  }

  // Revert the flag to its pre-experiment state.
  const flagDocRef = flagsCollection(projectId).doc(exp.flagKey);
  if (exp.previousFlagState) {
    await flagDocRef.update({
      rules: exp.previousFlagState.rules,
      defaultValue: exp.previousFlagState.defaultValue,
      enabled: exp.previousFlagState.enabled,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await docRef.update({
    status: 'stopped',
    stoppedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await invalidateFlag(projectId, exp.flagKey);
  await publishFlagChange(exp.flagKey, 'update');

  writeAuditRecord({
    projectId,
    action: 'experiment.stopped',
    performedBy,
    flagKey: exp.flagKey,
    before: { experimentId: id, name: exp.name },
  });

  const updated = await docRef.get();
  return { id: updated.id, ...updated.data() } as ExperimentDocument;
}

export async function concludeExperiment(
  projectId: string,
  id: string,
  winnerKey: string,
  performedBy: string,
): Promise<ExperimentDocument> {
  const docRef = experimentsCollection(projectId).doc(id);
  const existing = await docRef.get();
  if (!existing.exists) throw new AppError(`Experiment "${id}" not found`, 404);

  const exp = existing.data() as ExperimentDocument;
  if (exp.status !== 'running') {
    throw new AppError(`Cannot conclude experiment in "${exp.status}" state`, 400);
  }

  const winningVariant = exp.variants.find((v) => v.key === winnerKey);
  if (!winningVariant) {
    throw new AppError(`Variant "${winnerKey}" not found in experiment`, 400);
  }

  // Promote the winning variant: set flag default to winner's value, clear experiment rules.
  const flagDocRef = flagsCollection(projectId).doc(exp.flagKey);
  const prevState = exp.previousFlagState;
  await flagDocRef.update({
    defaultValue: winningVariant.value,
    rules: prevState?.rules ?? [],
    enabled: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await docRef.update({
    status: 'concluded',
    winner: winnerKey,
    stoppedAt: FieldValue.serverTimestamp(),
    concludedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await invalidateFlag(projectId, exp.flagKey);
  await publishFlagChange(exp.flagKey, 'update');

  writeAuditRecord({
    projectId,
    action: 'experiment.stopped',
    performedBy,
    flagKey: exp.flagKey,
    after: { experimentId: id, winner: winnerKey, promotedValue: winningVariant.value },
  });

  const updated = await docRef.get();
  return { id: updated.id, ...updated.data() } as ExperimentDocument;
}
