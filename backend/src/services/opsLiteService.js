import fs from 'node:fs/promises';
import path from 'node:path';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { SessionReport } from '../db/models/sessionReportModel.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const average = (values = []) => {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  return nums.length ? Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2)) : 0;
};

const latestReportArtifact = (analysis = {}) => ensureArray(analysis.reportArtifacts).at(-1) || {};

const REPORT_DIR_CANDIDATES = [
  path.resolve('eval/reports'),
  path.resolve('backend/eval/reports'),
];

const PLAN_RISK_CATEGORIES = [
  'factual_grounding',
  'cv_jd_alignment',
  'star_completeness',
  'interview_control',
  'rag_quality',
  'multi_turn_adaptiveness',
  'voice_quality',
  'safety_boundary',
  'company_research_grounding',
  'report_quality',
];

const SUITE_META = Object.freeze({
  'cv-parse-eval': {
    group: 'analysisQuality',
    label: 'CV parse analysis',
    categories: ['cv_jd_alignment'],
  },
  'jd-parse-eval': {
    group: 'analysisQuality',
    label: 'JD parse analysis',
    categories: ['cv_jd_alignment'],
  },
  'jd-parse-seek-benchmark': {
    group: 'analysisQuality',
    label: 'Real SEEK JD parsing',
    categories: ['cv_jd_alignment', 'safety_boundary'],
  },
  'cv-jd-match-eval': {
    group: 'analysisQuality',
    label: 'CV-JD match analysis',
    categories: ['cv_jd_alignment', 'factual_grounding'],
  },
  'interview-controller-eval': {
    group: 'trajectoryQuality',
    label: 'Interview decision control',
    categories: ['interview_control', 'multi_turn_adaptiveness'],
  },
  'agent-trajectory-eval': {
    group: 'trajectoryQuality',
    label: 'Agent trajectory quality',
    categories: ['interview_control', 'multi_turn_adaptiveness', 'factual_grounding', 'star_completeness'],
  },
  'end-to-end-interview-eval': {
    group: 'trajectoryQuality',
    label: 'Fixed scenario E2E',
    categories: ['interview_control', 'report_quality', 'factual_grounding', 'star_completeness'],
  },
  'kiwi-green-agent-eval': {
    group: 'trajectoryQuality',
    label: 'Kiwi Green Agent benchmark',
    categories: ['interview_control', 'report_quality', 'factual_grounding', 'star_completeness'],
  },
  'retrieval-eval': {
    group: 'groundingSafety',
    label: 'RAG retrieval grounding',
    categories: ['rag_quality', 'factual_grounding'],
  },
  'report-qa-eval': {
    group: 'groundingSafety',
    label: 'Report QA grounding',
    categories: ['report_quality', 'factual_grounding', 'star_completeness'],
  },
  'company-research-eval': {
    group: 'groundingSafety',
    label: 'Company research grounding',
    categories: ['company_research_grounding', 'factual_grounding'],
  },
  'baseline-comparison-eval': {
    group: 'groundingSafety',
    label: 'Generic baseline comparison',
    categories: ['report_quality'],
  },
  'voice-quality-eval': {
    group: 'voiceQuality',
    label: 'Voice transcript coaching quality',
    categories: ['voice_quality', 'multi_turn_adaptiveness'],
  },
  'voice-robustness-eval': {
    group: 'voiceQuality',
    label: 'Voice robustness',
    categories: ['voice_quality'],
  },
  'stability-eval': {
    group: 'reliability',
    label: 'Multi-trial stability',
    categories: ['multi_turn_adaptiveness', 'safety_boundary'],
  },
  'plan-eval-suite': {
    group: 'reliability',
    label: 'Plan eval execution coverage',
    categories: ['safety_boundary'],
  },
});

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
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch (_error) {
      // Backend can start from repo root or backend/. Try the next candidate.
    }
  }
  return null;
};

const thresholdValue = (thresholds = {}, key, fallback = 0) => {
  const value = Number(thresholds[key]);
  return Number.isFinite(value) ? value : fallback;
};

const didSuitePass = (summary = {}) => {
  if (summary.label === 'Plan Eval Suite Summary') {
    return Number(summary.reportsAvailable || 0) === Number(summary.suitesAttempted || 0)
      && Number(summary.processPassRate || 0) === 1;
  }

  const thresholds = summary.thresholds || {};
  const minAverage = thresholdValue(thresholds, 'minAverage', 0);
  const failBelow = thresholdValue(thresholds, 'failBelow', 0);
  const minCriticalAverage = thresholdValue(thresholds, 'minCriticalAverage', 0);
  const criticalFailBelow = thresholdValue(thresholds, 'criticalFailBelow', 0);

  const averagePassed = Number(summary.average || 0) >= minAverage;
  const criticalAveragePassed = summary.criticalAverage === undefined
    || Number(summary.criticalAverage || 0) >= minCriticalAverage;
  const casesPassed = ensureArray(summary.results).every((item) => Number(item.score || 0) >= failBelow);
  const criticalCasesPassed = ensureArray(summary.results).every((item) => (
    item.criticalScore === undefined || Number(item.criticalScore || 0) >= criticalFailBelow
  ));

  return averagePassed && criticalAveragePassed && casesPassed && criticalCasesPassed;
};

const collectFailedCases = (summary = {}) => ensureArray(summary.results)
  .filter((item) => ensureArray(item.failedChecks).length > 0)
  .map((item) => ({
    id: item.id || item.case || 'case',
    score: item.score,
    failedChecks: ensureArray(item.failedChecks),
  }));

const buildEmptyEvalReportSummary = () => ({
  reportDirectoryFound: false,
  totalSuites: 0,
  totalCases: 0,
  averageScore: 0,
  passRate: 0,
  warningCaseCount: 0,
  failedSuites: [],
  failedCases: [],
  suites: [],
  groups: {
    analysisQuality: [],
    trajectoryQuality: [],
    groundingSafety: [],
    voiceQuality: [],
    reliability: [],
  },
  riskCoverage: PLAN_RISK_CATEGORIES.map((category) => ({ category, covered: false, suiteCount: 0 })),
});

export const buildEvalReportSummary = async () => {
  const reportDir = await resolveEvalReportDirectory();
  if (!reportDir) {
    return buildEmptyEvalReportSummary();
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
  }, {
    analysisQuality: [],
    trajectoryQuality: [],
    groundingSafety: [],
    voiceQuality: [],
    reliability: [],
  });

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

export const buildRuntimeOpsSummary = async ({ userId = null } = {}) => {
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
      runtimeQaPassRate: qaResults.length ? Number((qaResults.filter((qa) => qa.passed).length / qaResults.length).toFixed(2)) : 0,
      modelAssistedTurnRate: trajectories.length ? Number((modelAssistedTurns / trajectories.length).toFixed(2)) : 0,
    },
    latency: {
      measurement: 'runtime_trace_average_not_voice_benchmark',
      note: 'This is the average from stored runtime trace fields. It is not the voice latency benchmark. Voice benchmark latency should measure end-of-speech to first audio sent.',
      traceSampleCount: latencyEvents.length,
      sttMs: latencyAverage('sttMs'),
      retrievalMs: latencyAverage('retrievalMs'),
      planningMs: latencyAverage('planningMs'),
      llmFirstTokenMs: latencyAverage('llmFirstTokenMs'),
      ttsFirstAudioMs: latencyAverage('ttsFirstAudioMs'),
      runtimeTraceTotalMs: latencyAverage('totalTurnMs'),
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
