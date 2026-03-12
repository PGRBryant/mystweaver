import { Router } from 'express';
import * as experimentService from '../services/experiment-service';
import { computeResults } from '../services/experiment-results';
import { validateBody } from '../middleware/validate';
import { AppError } from '../middleware/error-handler';
import type { CreateExperimentRequest, UpdateExperimentRequest } from '../types/experiment';

const router = Router();

function getProjectId(req: { query: Record<string, unknown> }): string {
  const pid = req.query.projectId;
  if (!pid || typeof pid !== 'string') {
    throw new AppError('projectId query parameter is required', 400);
  }
  return pid;
}

function getUser(req: { user?: { email: string } }): string {
  return req.user?.email ?? 'unknown';
}

// POST /api/experiments
router.post(
  '/',
  validateBody({ name: 'string', flagKey: 'string', metric: 'string' }),
  async (req, res, next) => {
    try {
      const experiment = await experimentService.createExperiment(
        getProjectId(req),
        req.body as CreateExperimentRequest,
        getUser(req),
      );
      res.status(201).json(experiment);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/experiments
router.get('/', async (req, res, next) => {
  try {
    const experiments = await experimentService.listExperiments(getProjectId(req));
    res.json(experiments);
  } catch (err) {
    next(err);
  }
});

// GET /api/experiments/:id
router.get('/:id', async (req, res, next) => {
  try {
    const experiment = await experimentService.getExperiment(
      getProjectId(req),
      req.params.id,
    );
    if (!experiment) {
      res.status(404).json({ error: `Experiment "${req.params.id}" not found` });
      return;
    }
    res.json(experiment);
  } catch (err) {
    next(err);
  }
});

// GET /api/experiments/:id/results
router.get('/:id/results', async (req, res, next) => {
  try {
    const results = await computeResults(getProjectId(req), req.params.id);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/experiments/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const experiment = await experimentService.updateExperiment(
      getProjectId(req),
      req.params.id,
      req.body as UpdateExperimentRequest,
      getUser(req),
    );
    res.json(experiment);
  } catch (err) {
    next(err);
  }
});

// POST /api/experiments/:id/start
router.post('/:id/start', async (req, res, next) => {
  try {
    const experiment = await experimentService.startExperiment(
      getProjectId(req),
      req.params.id,
      getUser(req),
    );
    res.json(experiment);
  } catch (err) {
    next(err);
  }
});

// POST /api/experiments/:id/stop
router.post('/:id/stop', async (req, res, next) => {
  try {
    const experiment = await experimentService.stopExperiment(
      getProjectId(req),
      req.params.id,
      getUser(req),
    );
    res.json(experiment);
  } catch (err) {
    next(err);
  }
});

// POST /api/experiments/:id/conclude
router.post('/:id/conclude', async (req, res, next) => {
  try {
    const { winner } = req.body as { winner: string };
    if (!winner || typeof winner !== 'string') {
      throw new AppError('winner (variant key) is required', 400);
    }
    const experiment = await experimentService.concludeExperiment(
      getProjectId(req),
      req.params.id,
      winner,
      getUser(req),
    );
    res.json(experiment);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/experiments/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await experimentService.deleteExperiment(
      getProjectId(req),
      req.params.id,
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
