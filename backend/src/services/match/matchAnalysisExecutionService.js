/**
 * File responsibility: Execute one canonical Match, persistence, and question-filter boundary.
 */

import { runCvJdMatchExecution } from '../cv/cvAnalysisService.js';
import {
  createMatchAnalysisRecord,
  updateMatchAnalysisPerformanceTrace,
} from '../cv/matchAnalysisRecordService.js';
import { recordLocalUsage } from '../aiUsageTrackingService.js';
import { buildJdQuestionFilter } from '../questions/jdQuestionFilterService.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/appError.js';
import { createMatchPerformanceTrace } from './matchPerformanceTraceService.js';

const buildTraceContext = ({ matchData, matchAnalysisId, jdQuestionFilterStatus }) => ({
  matchAnalysisId,
  cacheHit: Boolean(matchData?.cache?.hit),
  cacheSource: matchData?.cache?.source || null,
  compareAttempts: matchData?.safeguard?.compareAttempts || null,
  jdQuestionFilterStatus,
});

export const executeCanonicalMatch = async ({
  cvId,
  userId,
  rawJD,
  jdRubric,
  settings = {},
  requestId,
  requestMeta = {},
  progressReporter = null,
}) => {
  const performanceTrace = createMatchPerformanceTrace({
    requestId,
    cvId,
    matchEngine: settings?.matchEngine || process.env.MATCH_ENGINE || 'default',
  }, {
    onStep: progressReporter?.observeTraceStep,
  });

  const { matchData, cvDocument } = await runCvJdMatchExecution({
    cvId,
    userId,
    rawJD,
    jdRubric,
    settings,
    performanceTrace,
    progressReporter,
  });

  let persisted;
  try {
    persisted = await performanceTrace.measure(
      'match_record_persist',
      () => createMatchAnalysisRecord({
        userId,
        cvFileId: cvId,
        jdStructuredText: rawJD || '',
        jdRubric,
        matchData,
        cvDocument,
      }),
      {
        hasWarnings: Boolean((matchData?.warnings || []).length || (cvDocument.parseWarnings || []).length),
      },
    );
  } catch {
    throw new AppError('Match analysis could not be saved. Please retry.', {
      statusCode: 503,
      code: 'PERSISTENCE_FAILED',
      details: 'Match analysis could not be saved. Please retry.',
      expose: true,
    });
  }

  let jdQuestionFilterStatus = 'created';
  try {
    await performanceTrace.measure('jd_question_filter_build', () => buildJdQuestionFilter({
      userId,
      cvFileId: cvId,
      jdFingerprint: matchData?.parsedJdProfile?.metadata?.jdFingerprint
        || jdRubric?.metadata?.jdFingerprint
        || '',
      rawJD,
      jdRubric: jdRubric || matchData?.parsedJdProfile || null,
      analysisResult: matchData,
      matchAnalysisId: persisted.matchAnalysisId,
      settings,
    }), {
      matchAnalysisId: persisted.matchAnalysisId,
    });
  } catch (error) {
    jdQuestionFilterStatus = 'failed';
    logger.warn('JD question filter generation failed', {
      ...requestMeta,
      userId,
      cvId,
      matchAnalysisId: persisted.matchAnalysisId,
      error: error.message,
    });
  }

  const preliminaryTrace = performanceTrace.toJSON(buildTraceContext({
    matchData,
    matchAnalysisId: persisted.matchAnalysisId,
    jdQuestionFilterStatus,
  }));

  await performanceTrace.measure('usage_record', () => recordLocalUsage({
    userId,
    stage: 'cv_jd_match',
    operation: 'local_match',
    metadata: {
      cvId,
      matchAnalysisId: persisted.matchAnalysisId,
      rawJdLength: String(rawJD || '').length,
      hasJdRubric: Boolean(jdRubric),
      durationMs: preliminaryTrace.totalMs,
      cacheHit: Boolean(matchData?.cache?.hit),
      cacheSource: matchData?.cache?.source || null,
      compareAttempts: matchData?.safeguard?.compareAttempts || null,
      matchEngine: settings?.matchEngine || process.env.MATCH_ENGINE || 'default',
      jdQuestionFilterStatus,
      slowestStep: preliminaryTrace.slowestSteps?.[0]?.step || null,
      slowestStepMs: preliminaryTrace.slowestSteps?.[0]?.durationMs || null,
    },
  }), {
    matchAnalysisId: persisted.matchAnalysisId,
  });

  const finalPerformanceTrace = performanceTrace.toJSON(buildTraceContext({
    matchData,
    matchAnalysisId: persisted.matchAnalysisId,
    jdQuestionFilterStatus,
  }));

  try {
    await updateMatchAnalysisPerformanceTrace({
      userId,
      matchAnalysisId: persisted.matchAnalysisId,
      performanceTrace: finalPerformanceTrace,
    });
  } catch (error) {
    logger.warn('Match performance trace persistence failed', {
      ...requestMeta,
      userId,
      cvId,
      matchAnalysisId: persisted.matchAnalysisId,
      error: error.message,
    });
  }

  logger.info('CV and JD match completed', {
    ...requestMeta,
    userId,
    cvId,
    matchAnalysisId: persisted.matchAnalysisId,
    strengthsCount: matchData?.strengths?.length || 0,
    gapsCount: matchData?.gaps?.length || 0,
    durationMs: finalPerformanceTrace.totalMs,
    cacheHit: finalPerformanceTrace.cacheHit,
    performanceTrace: {
      schemaVersion: finalPerformanceTrace.schemaVersion,
      totalMs: finalPerformanceTrace.totalMs,
      steps: finalPerformanceTrace.steps,
      stepSummary: finalPerformanceTrace.stepSummary,
      slowestSteps: finalPerformanceTrace.slowestSteps,
    },
  });

  return {
    ...matchData,
    matchAnalysisId: persisted.matchAnalysisId,
    evidenceRefs: persisted.evidenceRefs,
    performanceTrace: finalPerformanceTrace,
  };
};
