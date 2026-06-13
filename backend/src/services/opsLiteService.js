import fs from 'node:fs/promises';
import path from 'node:path';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { SessionReport } from '../db/models/sessionReportModel.js';
import {
  REPORT_DIR_CANDIDATES,
  PLAN_RISK_CATEGORIES,
  SUITE_META,
  DEFAULT_GROUPS,
} from '../config/opsLiteConfig.js';
import {
  ensureArray,
  average,
  latestReportArtifact,
  didSuitePass,
  collectFailedCases,
  buildEmptyEvalReportSummary,
  getLatencyPayload,
  resolveVoiceResponseLatencyMs,
  resolveRuntimeTotalMs,
  resolveLatencyDurationMs,
  firstFinite,
  getStepMarkMs,
} from '../utils/opsLiteHelpers.js';

const RUNTIME_ANALYSIS_FIELDS = [
  'sessionId',
  'reportArtifacts',
  'agentTraceEvents',
  'trajectoryRecords',
  'latestVoiceDeliverySummary',
].join(' ');

const RUNTIME_REPORT_FIELDS = [
  'sessionId',
  'qaResult',
  'report.evidenceDiagnostics.claimEvidence',
].join(' ');

const safeReadJson = async (filePath) => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
};

const resolveEvalReportDirectory = async () => {
  for (const candidate of REPORT_DIR_CANDIDATES) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch (_error) {
      // Backend can start from repo root or backend/. Try the next candidate.
    }
  }
  return null;
};

export const buildEvalReportSummary = async () => {
  const reportDir = await resolveEvalReportDirectory();
  if (!reportDir) {
    const emptySummary = buildEmptyEvalReportSummary();
    emptySummary.riskCoverage = PLAN_RISK_CATEGORIES.map((category) => ({
      category,
      covered: false,
      suiteCount: 0,
    }));
    return emptySummary;
  }

  const files = (await fs.readdir(reportDir)).filter((file) => file.endsWith('.latest.json')).sort();
  const suites = [];

  for (const file of files) {
    const summary = await safeReadJson(path.join(reportDir, file));
    if (!summary) continue;

    const id = file.replace('.latest.json', '');
    const meta = SUITE_META[id] || { group: 'reliability', label: id.replace(/-/g, ' '), categories: [] };
    const failedCases = collectFailedCases(summary);
    const passed = didSuitePass(summary);
    const casesRun = Number(summary.casesRun || summary.suitesAttempted || ensureArray(summary.results).length || 0);
    const averageScore = Number(summary.average ?? summary.reportAverageScore ?? 0);

    suites.push({
      id,
      file,
      label: meta.label,
      group: meta.group,
      categories: meta.categories,
      casesRun,
      average: averageScore,
      criticalAverage: summary.criticalAverage,
      thresholds: summary.thresholds || {},
      passed,
      warningStatus: passed && failedCases.length > 0 ? 'pass_with_warnings' : passed ? 'strong_pass' : 'needs_work',
      failedCaseCount: failedCases.length,
      failedCases: failedCases.slice(0, 8),
      generatedAt: summary.generatedAt || null,
    });
  }

  const groups = suites.reduce((acc, suite) => {
    acc[suite.group] = [...(acc[suite.group] || []), suite];
    return acc;
  }, { ...DEFAULT_GROUPS });

  const categoryCounts = suites.flatMap((suite) => suite.categories).reduce((acc, category) => {
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const failedSuites = suites.filter((suite) => !suite.passed);
  const failedCases = suites.flatMap((suite) => suite.failedCases.map((item) => ({ ...item, suite: suite.label })));

  return {
    reportDirectoryFound: true,
    totalSuites: suites.length,
    totalCases: suites.reduce((sum, suite) => sum + suite.casesRun, 0),
    averageScore: average(suites.map((suite) => suite.average)),
    passRate: suites.length ? Number((suites.filter((suite) => suite.passed).length / suites.length).toFixed(2)) : 0,
    warningCaseCount: failedCases.length,
    failedSuites: failedSuites.map((suite) => suite.label),
    failedCases: failedCases.slice(0, 20),
    suites,
    groups,
    riskCoverage: PLAN_RISK_CATEGORIES.map((category) => ({
      category,
      covered: Number(categoryCounts[category] || 0) > 0,
      suiteCount: Number(categoryCounts[category] || 0),
    })),
  };
};

const buildEmptyRuntimeOpsSummary = ({ warning = null } = {}) => ({
  overview: {
    totalSessions: 0,
    textSessions: 0,
    voiceSessions: 0,
    averageCoachingConfidence: 0,
    averageReportQualityScore: 0,
    runtimeQaPassRate: 0,
    modelAssistedTurnRate: 0,
  },
  latency: {
    measurement: 'actual_voice_interview_session_trace',
    note: 'Voice response latency uses stored interview-session trace marks and prioritises first_audio_sent, then adaptive.tts_first_audio, then first_sentence_ready. Runtime trace total is shown separately as a full-turn diagnostic.',
    traceSampleCount: 0,
    voiceLatencySampleCount: 0,
    averageQuestionGapLatencyMs: 0,
    voiceResponseLatencyMs: 0,
    runtimeTraceTotalMs: 0,
    totalTurnMs: 0,
    sttMs: 0,
    retrievalMs: 0,
    planningMs: 0,
    llmFirstTokenMs: 0,
    ttsFirstAudioMs: 0,
    firstAudioSentMs: 0,
  },
  rag: {
    activationRate: 0,
    sourceUsage: {},
    degradedRetrievalRate: 0,
    unsupportedEvidenceBlockedCount: 0,
  },
  voice: {
    sessionsWithVoiceMetrics: 0,
    averageWordsPerMinute: 0,
    totalFillerCount: 0,
    totalLongPauseCount: 0,
    lowConfidenceDeliverySessions: 0,
  },
  evals: {
    qaCases: 0,
    passedQaCases: 0,
    failedCases: [],
    stabilityScore: 0,
  },
  runtimeStatus: {
    ok: !warning,
    warning,
  },
});

const findRecentSessionAnalyses = (query) => SessionAnalysis.find(query)
  .sort({ updatedAt: -1 })
  .allowDiskUse(true)
  .limit(100)
  .select(RUNTIME_ANALYSIS_FIELDS)
  .lean();

const findSessionReports = (sessionIds = []) => SessionReport.find({ sessionId: { $in: sessionIds } })
  .select(RUNTIME_REPORT_FIELDS)
  .lean();

export const buildRuntimeOpsSummary = async ({ userId = null } = {}) => {
  let runtimeRecords;
  try {
    const analyses = await findRecentSessionAnalyses(userId ? { userId } : {});
    const sessionIds = analyses.map((item) => item.sessionId).filter(Boolean);
    const reports = sessionIds.length ? await findSessionReports(sessionIds) : [];
    runtimeRecords = { analyses, reports };
  } catch (error) {
    return buildEmptyRuntimeOpsSummary({ warning: error.message });
  }
  const { analyses, reports } = runtimeRecords;
  const reportBySession = new Map(reports.map((report) => [report.sessionId, report]));
  const traceEvents = analyses.flatMap((item) => ensureArray(item.agentTraceEvents));
  const trajectories = analyses.flatMap((item) => ensureArray(item.trajectoryRecords));
  const qaResults = analyses.map((item) => latestReportArtifact(item).qaResult || reportBySession.get(item.sessionId)?.qaResult).filter(Boolean);
  const voiceSummaries = analyses.map((item) => item.latestVoiceDeliverySummary).filter(Boolean);
  const claimDiagnostics = analyses
    .map((item) => latestReportArtifact(item).report?.evidenceDiagnostics?.claimEvidence || reportBySession.get(item.sessionId)?.report?.evidenceDiagnostics?.claimEvidence)
    .filter(Boolean);

  const modelAssistedTurns = trajectories.filter((item) => item.selectionSource === 'model_assisted').length;
  const latencyEvents = traceEvents.filter((event) => Object.keys(getLatencyPayload(event)).length > 0);
  const voiceLatencyValues = latencyEvents.map(resolveVoiceResponseLatencyMs).filter((value) => value != null);
  const runtimeTotalValues = latencyEvents.map(resolveRuntimeTotalMs).filter((value) => value != null);
  const averageVoiceResponseLatencyMs = average(voiceLatencyValues);
  const averageRuntimeTraceTotalMs = average(runtimeTotalValues);
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
      runtimeQaPassRate: qaResults.length ? Number((qaResults.filter((qa) => qa.passed).length / qaResults.length).toFixed(2)) : 0,
      modelAssistedTurnRate: trajectories.length ? Number((modelAssistedTurns / trajectories.length).toFixed(2)) : 0,
    },
    latency: {
      measurement: 'actual_voice_interview_session_trace',
      note: 'Voice response latency uses stored interview-session trace marks and prioritises first_audio_sent, then adaptive.tts_first_audio, then first_sentence_ready. Runtime trace total is shown separately as a full-turn diagnostic.',
      traceSampleCount: latencyEvents.length,
      voiceLatencySampleCount: voiceLatencyValues.length,
      averageQuestionGapLatencyMs: averageVoiceResponseLatencyMs,
      voiceResponseLatencyMs: averageVoiceResponseLatencyMs,
      runtimeTraceTotalMs: averageRuntimeTraceTotalMs,
      totalTurnMs: averageRuntimeTraceTotalMs,
      sttMs: average(latencyEvents.map((event) => resolveLatencyDurationMs(event, ['stt'], ['sttMs']))),
      retrievalMs: average(latencyEvents.map((event) => resolveLatencyDurationMs(event, ['adaptive.retrieval'], ['retrievalMs']))),
      planningMs: average(latencyEvents.map((event) => resolveLatencyDurationMs(event, ['adaptive.action_selection', 'adaptive.decision_context'], ['planningMs']))),
      llmFirstTokenMs: average(latencyEvents.map((event) => firstFinite(getLatencyPayload(event).llmFirstTokenMs, getStepMarkMs(getLatencyPayload(event), ['adaptive.llm_first_token'])))),
      ttsFirstAudioMs: average(latencyEvents.map((event) => firstFinite(getLatencyPayload(event).ttsFirstAudioMs, getStepMarkMs(getLatencyPayload(event), ['adaptive.tts_first_audio'])))),
      firstAudioSentMs: average(latencyEvents.map((event) => firstFinite(getLatencyPayload(event).firstAudioSentMs, getStepMarkMs(getLatencyPayload(event), ['first_audio_sent'])))),
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

export const buildOpsLiteSummary = async ({ userId = null } = {}) => {
  const [runtime, agentEvaluation] = await Promise.all([
    buildRuntimeOpsSummary({ userId }),
    buildEvalReportSummary(),
  ]);

  return {
    ...runtime,
    agentEvaluation,
    overview: {
      ...runtime.overview,
      latestEvalPassRate: agentEvaluation.passRate,
      latestEvalAverageScore: agentEvaluation.averageScore,
      totalEvalSuites: agentEvaluation.totalSuites,
      totalEvalCases: agentEvaluation.totalCases,
      warningCaseCount: agentEvaluation.warningCaseCount,
    },
  };
};

// Made with Bob
