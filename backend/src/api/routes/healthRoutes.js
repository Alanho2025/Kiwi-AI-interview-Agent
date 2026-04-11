/**
 * File responsibility: Route registration module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: healthRoutes should register endpoints and keep route wiring separate from controller logic.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import express from 'express';
import { checkMongoHealth } from '../../db/mongo.js';
import { checkPostgresHealth } from '../../db/postgres.js';
import { formatSuccess } from '../../utils/responseFormatter.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [postgres, mongo] = await Promise.all([
      checkPostgresHealth(),
      checkMongoHealth(),
    ]);

    const startup = req.app?.locals?.startupStatus || null;
    const allHealthy = postgres.ok && mongo.ok;
    const payload = {
      ok: allHealthy,
      mode: allHealthy ? 'normal' : 'degraded',
      postgres,
      mongo,
      startup,
    };

    return res.status(allHealthy ? 200 : 503).json(
      formatSuccess(allHealthy ? 'Services are healthy' : 'One or more services are unhealthy', payload),
    );
  } catch (error) {
    return next(error);
  }
});

export default router;
