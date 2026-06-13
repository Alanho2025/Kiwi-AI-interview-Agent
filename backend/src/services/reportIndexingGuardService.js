/**
 * File responsibility: Report indexing guard service.
 * Main responsibilities:
 * - Keep report generation resilient when optional RAG indexing is unavailable.
 * - Preserve diagnostics for degraded report evidence retrieval.
 */

import { indexSessionArtifacts } from './ragIndexService.js';
import { logger } from '../utils/logger.js';

export const indexReportSessionArtifactsSafely = async ({ sessionId }) => {
  try {
    const records = await indexSessionArtifacts(sessionId);
    return { ok: true, recordCount: records.length };
  } catch (error) {
    logger.warn('Report generation continuing after RAG indexing failed', {
      sessionId,
      error: error.message,
    });
    return { ok: false, recordCount: 0, error: error.message };
  }
};
