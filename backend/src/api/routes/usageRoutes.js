/**
 * File responsibility: Token usage API routes.
 * Provides cumulative usage summary and recent session breakdowns.
 */

import { Router } from 'express';
import { getUsageSummary, getRecentSessionUsage } from '../../services/usageTrackingService.js';

const router = Router();

/**
 * GET /api/usage/summary
 * Returns the authenticated user's cumulative token usage and estimated cost.
 */
router.get('/summary', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', details: 'Authentication required.' } });
    }
    const summary = await getUsageSummary(userId);
    return res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/usage/recent-sessions
 * Returns the current user's recent session-level token usage breakdown.
 * Query params: limit (default 5)
 */
router.get('/recent-sessions', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', details: 'Authentication required.' } });
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);
    const sessions = await getRecentSessionUsage(userId, limit);
    return res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

export default router;
