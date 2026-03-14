import { Router } from 'express';
import { sdkAuth } from '../middleware/api-key-auth';
import { getFlagConfig } from '../services/flag-service';

const router = Router();

// TODO(verika): sdkAuth will also accept Verika service tokens once api-key-auth.ts is updated.
router.use(sdkAuth);

// GET /sdk/flags — full flag config in a single read (for local evaluation)
router.get('/', async (req, res, next) => {
  try {
    const projectId = req.sdkProjectId!;
    const config = await getFlagConfig(projectId);

    if (!config) {
      res.json({ flags: {}, flagCount: 0 });
      return;
    }

    // Allow CDN / browser caching (short TTL, revalidate via SSE)
    res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
    res.json({
      flags: config.flags,
      flagCount: config.flagCount,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
