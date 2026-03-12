import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import * as sdkKeyService from '../services/sdk-key-service';
import type { CreateSDKKeyRequest } from '../types/sdk-key';

const router = Router();

// POST /api/sdk-keys — create a new SDK key
router.post('/', validateBody({ name: 'string', projectId: 'string' }), async (req, res, next) => {
  try {
    const result = await sdkKeyService.createSDKKey(req.body as CreateSDKKeyRequest);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/sdk-keys — list all SDK keys (metadata only)
router.get('/', async (_req, res, next) => {
  try {
    const keys = await sdkKeyService.listSDKKeys();
    res.json(keys);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sdk-keys/:id — revoke a key
router.delete('/:id', async (req, res, next) => {
  try {
    await sdkKeyService.revokeSDKKey(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
