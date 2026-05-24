/**
 * File responsibility: Token usage API routes.
 * Provides cumulative usage summary and recent session breakdowns.
 */

import { Router } from 'express';
import { getUsageSummary, getRecentSessionUsage } from '../../services/usageTrackingService.js';
import {
  getRecentAiSessionUsage,
  getSessionExecutionCost,
  getUserAiUsageSummary,
} from '../../services/aiUsageTrackingService.js';

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
    const [tokenSummary, aiSummary] = await Promise.all([
      getUsageSummary(userId),
      getUserAiUsageSummary(userId),
    ]);
    const summary = {
      ...tokenSummary,
      ai: aiSummary,
      currency: aiSummary.currency || tokenSummary.currency,
      totalCost: aiSummary.totalCost || tokenSummary.totalCost,
      providerBreakdown: aiSummary.providerBreakdown,
      measuredSessions: aiSummary.measuredSessions,
      speechAudioSeconds: aiSummary.speechAudioSeconds,
      speechTextCharacters: aiSummary.speechTextCharacters,
    };
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
    const [aiSessions, tokenSessions] = await Promise.all([
      getRecentAiSessionUsage(userId, limit),
      getRecentSessionUsage(userId, limit),
    ]);
    const sessions = aiSessions.length ? aiSessions : tokenSessions;
    return res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/usage/execution/:sessionId
 * Returns session-level execution cost with provider and stage breakdowns.
 */
router.get('/execution/:sessionId', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', details: 'Authentication required.' } });
    }

    const executionCost = await getSessionExecutionCost({ userId, sessionId: req.params.sessionId });
    return res.json({ success: true, data: executionCost });
  } catch (error) {
    next(error);
  }
});

export default router;
