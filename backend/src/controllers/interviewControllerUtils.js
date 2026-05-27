import { runTask } from '../services/masterAiService.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';

export const tryGenerateReportForCompletedSession = async (req, sessionId) => {
  try {
    const result = await runTask({ taskType: 'generate_report', sessionId });
    logger.info('Report generated after interview completion', getRequestLogMeta(req, {
      sessionId,
      latestStatus: result?.stored?.latestStatus || null,
    }));
    return result;
  } catch (error) {
    logger.error('Report generation failed after interview completion', getRequestLogMeta(req, {
      sessionId,
      error,
    }));
    return null;
  }
};
