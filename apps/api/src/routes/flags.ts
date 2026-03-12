import { Router } from 'express';
import * as flagService from '../services/flag-service';
import { validateBody } from '../middleware/validate';
import type { CreateFlagRequest, UpdateFlagRequest } from '../types/api';

const router = Router();

// POST /api/v1/flags — create a flag
router.post(
  '/',
  validateBody({
    key: 'string',
    name: 'string',
    type: 'string',
    defaultValue: { type: 'boolean', required: true }, // any type accepted, checked loosely
  }),
  async (req, res, next) => {
    try {
      const flag = await flagService.createFlag(req.body as CreateFlagRequest);
      res.status(201).json(flag);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/flags — list all flags
router.get('/', async (_req, res, next) => {
  try {
    const flags = await flagService.listFlags();
    res.json(flags);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/flags/:key — get a single flag
router.get('/:key', async (req, res, next) => {
  try {
    const flag = await flagService.getFlag(req.params.key);
    if (!flag) {
      res.status(404).json({ error: `Flag "${req.params.key}" not found` });
      return;
    }
    res.json(flag);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/flags/:key — update a flag
router.patch('/:key', async (req, res, next) => {
  try {
    const flag = await flagService.updateFlag(
      req.params.key,
      req.body as UpdateFlagRequest,
    );
    res.json(flag);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/flags/:key — delete a flag
router.delete('/:key', async (req, res, next) => {
  try {
    await flagService.deleteFlag(req.params.key);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
