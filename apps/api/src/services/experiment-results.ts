import { eventsCollection, experimentsCollection } from '../db/firestore';
import { AppError } from '../middleware/error-handler';
import { metrics as appMetrics } from '../metrics';
import type { ExperimentDocument, ExperimentResults, VariantResult } from '../types/experiment';

// ── Statistics helpers ───────────────────────────────────────────────────

/**
 * Approximate the cumulative distribution function (CDF) of the standard
 * normal distribution using the Abramowitz–Stegun rational approximation.
 * Accurate to ~1.5×10⁻⁷.
 */
function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Two-tailed Welch's t-test.
 * Returns p-value comparing two sample means with potentially unequal variances.
 *
 * Uses normal approximation for large samples (df > 30), which is valid
 * for the experiment sizes we expect. For smaller samples this is conservative.
 */
function welchTTest(
  n1: number,
  mean1: number,
  var1: number,
  n2: number,
  mean2: number,
  var2: number,
): number {
  if (n1 < 2 || n2 < 2) return 1; // not enough data
  if (var1 === 0 && var2 === 0) return mean1 === mean2 ? 1 : 0;

  const se = Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) return 1;

  const t = (mean1 - mean2) / se;

  // Two-tailed p-value using normal approximation.
  return 2 * (1 - normalCdf(Math.abs(t)));
}

// ── Results computation ──────────────────────────────────────────────────

interface EventData {
  type: string;
  flagKey?: string;
  event?: string;
  userId?: string;
  value?: unknown;
  timestamp?: number;
}

/**
 * Compute experiment results by correlating evaluation events with metric events.
 *
 * 1. Find all `flag.evaluated` events for the experiment's flag during the
 *    experiment window — this tells us which variant each user received.
 * 2. Find all metric events matching the experiment's metric.
 * 3. For each variant, compute conversion rate and mean/stdDev of the metric.
 */
export async function computeResults(
  projectId: string,
  experimentId: string,
): Promise<ExperimentResults> {
  const expDoc = await experimentsCollection(projectId).doc(experimentId).get();
  if (!expDoc.exists) throw new AppError(`Experiment "${experimentId}" not found`, 404);
  const exp = expDoc.data() as ExperimentDocument;

  const eventsCol = eventsCollection(projectId);

  // Determine time window.
  const startMs = exp.startedAt
    ? (exp.startedAt as unknown as { toMillis: () => number }).toMillis()
    : 0;
  const endMs = exp.stoppedAt
    ? (exp.stoppedAt as unknown as { toMillis: () => number }).toMillis()
    : Date.now();

  // Fetch evaluation events for this flag.
  const evalSnapshot = await eventsCol
    .where('type', '==', 'flag.evaluated')
    .where('flagKey', '==', exp.flagKey)
    .orderBy('timestamp', 'asc')
    .limit(10000)
    .get();

  // Build user → variant assignment map.
  // The variant is determined by matching the evaluated value to experiment variants.
  const userVariant = new Map<string, string>();
  const variantValues = new Map<string, unknown>();
  for (const v of exp.variants) {
    variantValues.set(v.key, v.value);
  }

  for (const doc of evalSnapshot.docs) {
    const data = doc.data() as EventData;
    if (!data.userId) continue;
    const ts = data.timestamp ?? 0;
    if (ts < startMs / 1000 || ts > endMs / 1000) continue;

    // Match evaluated value to a variant.
    for (const v of exp.variants) {
      if (String(data.value) === String(v.value)) {
        userVariant.set(data.userId, v.key);
        break;
      }
    }
  }

  // Fetch metric events.
  const metricSnapshot = await eventsCol
    .where('type', '==', 'metric.tracked')
    .where('event', '==', exp.metric)
    .orderBy('timestamp', 'asc')
    .limit(10000)
    .get();

  // Group metric values by variant.
  const variantMetrics = new Map<string, number[]>();
  for (const v of exp.variants) {
    variantMetrics.set(v.key, []);
  }

  const usersWithMetric = new Set<string>();
  for (const doc of metricSnapshot.docs) {
    const data = doc.data() as EventData;
    if (!data.userId) continue;
    const ts = data.timestamp ?? 0;
    if (ts < startMs / 1000 || ts > endMs / 1000) continue;

    const variant = userVariant.get(data.userId);
    if (!variant) continue;

    usersWithMetric.add(data.userId);
    const metrics = variantMetrics.get(variant);
    if (metrics) {
      // Use value if present (for numeric metrics), otherwise count as 1 (conversion).
      metrics.push(typeof data.value === 'number' ? data.value : 1);
    }
  }

  // Compute per-variant statistics.
  const variantResults: Record<string, VariantResult> = {};
  const variantKeys: string[] = [];

  for (const v of exp.variants) {
    const metrics = variantMetrics.get(v.key) ?? [];
    // Sample size = number of users assigned this variant.
    const assignedUsers = [...userVariant.entries()].filter(([, vk]) => vk === v.key).length;
    const sampleSize = assignedUsers;
    const conversions = metrics.length;
    const conversionRate = sampleSize > 0 ? conversions / sampleSize : 0;

    // Mean and stdDev of metric values.
    let mean = 0;
    let stdDev = 0;
    if (metrics.length > 0) {
      mean = metrics.reduce((s, x) => s + x, 0) / metrics.length;
      if (metrics.length > 1) {
        const variance = metrics.reduce((s, x) => s + (x - mean) ** 2, 0) / (metrics.length - 1);
        stdDev = Math.sqrt(variance);
      }
    }

    variantResults[v.key] = { sampleSize, conversionRate, mean, stdDev };
    appMetrics.experimentSampleSize.set({ experimentId, variant: v.key }, sampleSize);
    variantKeys.push(v.key);
  }

  // Compute p-value (first variant vs second variant).
  let pValue: number | null = null;
  if (variantKeys.length >= 2) {
    const a = variantResults[variantKeys[0]];
    const b = variantResults[variantKeys[1]];
    if (a.sampleSize >= 2 && b.sampleSize >= 2) {
      pValue = welchTTest(
        a.sampleSize,
        a.conversionRate,
        a.sampleSize > 0 ? a.conversionRate * (1 - a.conversionRate) : 0,
        b.sampleSize,
        b.conversionRate,
        b.sampleSize > 0 ? b.conversionRate * (1 - b.conversionRate) : 0,
      );
    }
  }

  const significanceReached = pValue !== null && pValue < 0.05;

  // Determine winner if significant.
  let winner: string | null = exp.winner ?? null;
  if (significanceReached && !winner && variantKeys.length >= 2) {
    const a = variantResults[variantKeys[0]];
    const b = variantResults[variantKeys[1]];
    winner = a.conversionRate >= b.conversionRate ? variantKeys[0] : variantKeys[1];
  }

  return {
    experimentId,
    status: exp.status,
    variants: variantResults,
    winner,
    pValue,
    significanceReached,
    confidenceLevel: 0.95,
    updatedAt: Date.now(),
  };
}
