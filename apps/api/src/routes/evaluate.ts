import { Router } from 'express';
import { apiKeyAuth } from '../middleware/api-key-auth';
import { validateBody } from '../middleware/validate';
import { getCachedFlag } from '../services/cache-service';
import { evaluateFlag } from '../services/evaluation-engine';
import type { EvaluateRequest, BatchEvaluateRequest, EvaluateResponse } from '../types/api';

const router = Router();

// All evaluate routes require API key auth.
router.use(apiKeyAuth);

// POST /api/v1/evaluate — evaluate a single flag
router.post(
  '/',
  validateBody({
    flagKey: 'string',
    context: 'object',
  }),
  async (req, res, next) => {
    try {
      const { flagKey, context } = req.body as EvaluateRequest;
      const flag = await getCachedFlag(flagKey);

      if (!flag) {
        res.json({ flagKey, value: null, type: 'boolean' } satisfies EvaluateResponse);
        return;
      }

      const value = evaluateFlag(flag, context);
      res.json({ flagKey, value, type: flag.type } satisfies EvaluateResponse);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/evaluate/batch — evaluate multiple flags
router.post(
  '/batch',
  validateBody({
    flagKeys: 'array',
    context: 'object',
  }),
  async (req, res, next) => {
    try {
      const { flagKeys, context } = req.body as BatchEvaluateRequest;

      const results = await Promise.all(
        flagKeys.map(async (flagKey): Promise<EvaluateResponse> => {
          const flag = await getCachedFlag(flagKey);
          if (!flag) return { flagKey, value: null, type: 'boolean' };
          return { flagKey, value: evaluateFlag(flag, context), type: flag.type };
        }),
      );

      res.json({ results });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
