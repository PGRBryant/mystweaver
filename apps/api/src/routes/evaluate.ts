import { Router } from 'express';
import { sdkAuth } from '../middleware/api-key-auth';
import { validateBody } from '../middleware/validate';
import { getCachedFlag } from '../services/cache-service';
import { evaluateFlag } from '../services/evaluation-engine';
import { metrics } from '../metrics';
import { evaluateSchema, bulkEvaluateSchema } from '../schemas';
import type { EvaluateRequest, BulkEvaluateRequest } from '../types/api';

const router = Router();

// All SDK evaluate routes require Bearer SDK key auth.
router.use(sdkAuth);

// POST /sdk/evaluate — evaluate a single flag
router.post(
  '/',
  validateBody(evaluateSchema),
  async (req, res, next) => {
    try {
      const start = Date.now();
      const { flagKey, userContext } = req.body as EvaluateRequest;
      const projectId = req.sdkProjectId!;
      const flag = await getCachedFlag(projectId, flagKey);
      const result = evaluateFlag(flag, flagKey, userContext);

      metrics.flagEvaluationsTotal.inc({ flagKey, reason: result.reason });
      metrics.flagEvaluationLatency.observe({ route: 'single' }, Date.now() - start);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /sdk/evaluate/bulk — evaluate multiple flags
router.post(
  '/bulk',
  validateBody(bulkEvaluateSchema),
  async (req, res, next) => {
    try {
      const { flags: flagKeys, userContext } = req.body as BulkEvaluateRequest;
      const projectId = req.sdkProjectId!;
      const start = Date.now();

      // Deduplicate keys, fetch in parallel.
      const uniqueKeys = [...new Set(flagKeys)];
      const flagMap = new Map<string, Awaited<ReturnType<typeof getCachedFlag>>>();
      await Promise.all(
        uniqueKeys.map(async (key) => {
          flagMap.set(key, await getCachedFlag(projectId, key));
        }),
      );

      // Evaluate all.
      const flags: Record<string, { value: unknown; reason: string; enabled: boolean }> = {};
      for (const key of flagKeys) {
        const flag = flagMap.get(key) ?? null;
        const result = evaluateFlag(flag, key, userContext);
        flags[key] = { value: result.value, reason: result.reason, enabled: result.enabled };
        metrics.flagEvaluationsTotal.inc({ flagKey: key, reason: result.reason });
      }

      metrics.flagEvaluationLatency.observe({ route: 'bulk' }, Date.now() - start);

      res.json({
        flags,
        evaluatedAt: Math.floor(Date.now() / 1000),
        durationMs: Date.now() - start,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
