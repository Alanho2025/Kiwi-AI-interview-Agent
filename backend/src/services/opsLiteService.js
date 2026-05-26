import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { SessionReport } from '../db/models/sessionReportModel.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const average = (values = []) => {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  return nums.length ? Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2)) : 0;
};

const latestReportArtifact = (analysis = {}) => ensureArray(analysis.reportArtifacts).at(-1) || {};

export const buildOpsLiteSummary = async ({ userId = null } = {}) => {
  const analyses = await SessionAnalysis.find(userId ? { userId } : {}).sort({ updatedAt: -1 }).limit(100).lean();
  const sessionIds = analyses.map((item) => item.sessionId).filter(Boolean);
  const reports = await SessionReport.find({ sessionId: { $in: sessionIds } }).lean();
  const reportBySession = new Map(reports.map((report) => [report.sessionId, report]));
  const traceEvents = analyses.flatMap((item) => ensureArray(item.agentTraceEvents));
  const trajectories = analyses.flatMap((item) => ensureArray(item.trajectoryRecords));
  const qaResults = analyses.map((item) => latestReportArtifact(item).qaResult || reportBySession.get(item.sessionId)?.qaResult).filter(Boolean);
  const voiceSummaries = analyses.map((item) => item.latestVoiceDeliverySummary).filter(Boolean);
  const claimDiagnostics = analyses
    .map((item) => latestReportArtifact(item).report?.evidenceDiagnostics?.claimEvidence || reportBySession.get(item.sessionId)?.report?.evidenceDiagnostics?.claimEvidence)
    .filter(Boolean);

  const modelAssistedTurns = trajectories.filter((item) => item.selectionSource === 'model_assisted').length;
  const latencyEvents = traceEvents.filter((event) => event.latencyBreakdown);
  const latencyAverage = (key) => average(latencyEvents.map((event) => event.latencyBreakdown?.[key]).filter((value) => value != null));
  const sourceUsage = traceEvents.flatMap((event) => ensureArray(event.retrievalSources)).reduce((acc, source) => {
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});
  const totalClaims = claimDiagnostics.reduce((sum, item) => sum + Number(item.totalClaims || 0), 0);
  const downgradedClaims = claimDiagnostics.reduce((sum, item) => sum + Number(item.downgradedClaims || 0), 0);
  const needsConfirmationClaims = claimDiagnostics.reduce((sum, item) => sum + Number(item.needsConfirmationClaims || 0), 0);

  return {
    overview: {
      totalSessions: analyses.length,
      textSessions: traceEvents.filter((event) => event.mode === 'text').length,
      voiceSessions: voiceSummaries.length,
      averageCoachingConfidence: average(qaResults.map((qa) => qa.coverageScore || 0)),
      averageReportQualityScore: average(qaResults.map((qa) => qa.coverageScore || 0)),
      latestEvalPassRate: qaResults.length ? Number((qaResults.filter((qa) => qa.passed).length / qaResults.length).toFixed(2)) : 0,
      modelAssistedTurnRate: trajectories.length ? Number((modelAssistedTurns / trajectories.length).toFixed(2)) : 0,
    },
    latency: {
      sttMs: latencyAverage('sttMs'),
      retrievalMs: latencyAverage('retrievalMs'),
      planningMs: latencyAverage('planningMs'),
      llmFirstTokenMs: latencyAverage('llmFirstTokenMs'),
      ttsFirstAudioMs: latencyAverage('ttsFirstAudioMs'),
      totalTurnMs: latencyAverage('totalTurnMs'),
    },
    rag: {
      activationRate: traceEvents.length ? Number((traceEvents.filter((event) => ensureArray(event.retrievalSources).length > 0).length / traceEvents.length).toFixed(2)) : 0,
      sourceUsage,
      degradedRetrievalRate: totalClaims ? Number((downgradedClaims / totalClaims).toFixed(2)) : 0,
      unsupportedEvidenceBlockedCount: needsConfirmationClaims,
    },
    voice: {
      sessionsWithVoiceMetrics: voiceSummaries.length,
      averageWordsPerMinute: average(voiceSummaries.map((item) => item.averageWordsPerMinute)),
      totalFillerCount: voiceSummaries.reduce((sum, item) => sum + Number(item.totalFillerCount || 0), 0),
      totalLongPauseCount: voiceSummaries.reduce((sum, item) => sum + Number(item.totalLongPauseCount || 0), 0),
      lowConfidenceDeliverySessions: voiceSummaries.filter((item) => item.deliveryConfidence === 'low').length,
    },
    evals: {
      qaCases: qaResults.length,
      passedQaCases: qaResults.filter((qa) => qa.passed).length,
      failedCases: qaResults.filter((qa) => !qa.passed).map((qa) => qa.reportId || 'report').slice(0, 10),
      stabilityScore: qaResults.length ? Number((qaResults.filter((qa) => qa.passed).length / qaResults.length).toFixed(2)) : 0,
    },
  };
};
