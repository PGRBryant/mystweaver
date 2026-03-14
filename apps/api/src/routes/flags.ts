import { Router } from 'express';
import * as flagService from '../services/flag-service';
import { validateBody } from '../middleware/validate';
import { createFlagSchema, updateFlagSchema } from '../schemas';
import { getProjectId, getUser } from '../middleware/route-helpers';
import type { CreateFlagRequest, UpdateFlagRequest } from '../types/api';

const router = Router();

// POST /api/flags
router.post('/', validateBody(createFlagSchema), async (req, res, next) => {
  try {
    const flag = await flagService.createFlag(
      getProjectId(req),
      req.body as CreateFlagRequest,
      getUser(req),
    );
    res.status(201).json(flag);
  } catch (err) {
    next(err);
  }
});

// GET /api/flags
router.get('/', async (req, res, next) => {
  try {
    const flags = await flagService.listFlags(getProjectId(req));
    res.json(flags);
  } catch (err) {
    next(err);
  }
});

// GET /api/flags/:key
router.get('/:key', async (req, res, next) => {
  try {
    const flag = await flagService.getFlag(getProjectId(req), req.params.key);
    if (!flag) {
      res.status(404).json({ error: `Flag "${req.params.key}" not found` });
      return;
    }
    res.json(flag);
  } catch (err) {
    next(err);
  }
});

// PUT /api/flags/:key — full replace
router.put('/:key', validateBody(createFlagSchema), async (req, res, next) => {
  try {
    const flag = await flagService.replaceFlag(
      getProjectId(req),
      req.params.key,
      req.body as CreateFlagRequest,
      getUser(req),
    );
    res.json(flag);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/flags/:key — partial update
router.patch('/:key', validateBody(updateFlagSchema), async (req, res, next) => {
  try {
    const flag = await flagService.updateFlag(
      getProjectId(req),
      req.params.key,
      req.body as UpdateFlagRequest,
      getUser(req),
    );
    res.json(flag);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/flags/:key — soft delete
router.delete('/:key', async (req, res, next) => {
  try {
    await flagService.deleteFlag(getProjectId(req), req.params.key, getUser(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
