import { buildAnalyzeOutput, buildExplanationObject } from './scoringSchemaService.js';

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const ensureArray = (value) => (Array.isArray(value) ? value : []);
const ensureNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const ensureString = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

const normalizeDecision = (decision = {}) => ({
  label: ensureString(decision.label, 'manual_review'),
  reasonCodes: ensureArray(decision.reasonCodes).filter(Boolean),
});

export const validateAnalyzeOutput = (payload = {}) => {
  const safePayload = isObject(payload) ? payload : {};
  return buildAnalyzeOutput({
    candidateName: ensureString(safePayload.candidateName, 'Candidate'),
    jobTitle: ensureString(safePayload.jobTitle, 'Target Role'),
    overallScore: ensureNumber(safePayload.overallScore ?? safePayload.matchScore, 0),
    confidence: ensureNumber(safePayload.confidence, 0.4),
    decision: normalizeDecision(safePayload.decision || {}),
    parsedCvProfile: isObject(safePayload.parsedCvProfile) ? safePayload.parsedCvProfile : {},
    parsedJdProfile: isObject(safePayload.parsedJdProfile) ? safePayload.parsedJdProfile : {},
    macroScores: ensureArray(safePayload.macroScores),
    microScores: ensureArray(safePayload.microScores),
    requirementChecks: ensureArray(safePayload.requirementChecks),
    scoreBreakdown: isObject(safePayload.scoreBreakdown) ? safePayload.scoreBreakdown : {},
    explanation: isObject(safePayload.explanation)
      ? {
          strengths: ensureArray(safePayload.explanation.strengths),
          gaps: ensureArray(safePayload.explanation.gaps),
          risks: ensureArray(safePayload.explanation.risks),
          summary: ensureString(safePayload.explanation.summary),
        }
      : buildExplanationObject(),
    evidenceMap: ensureArray(safePayload.evidenceMap),
    sourceSnapshots: ensureArray(safePayload.sourceSnapshots),
    matchingDetails: isObject(safePayload.matchingDetails) ? safePayload.matchingDetails : {},
    legacy: {
      interviewFocus: ensureArray(safePayload.interviewFocus),
      planPreview: ensureString(safePayload.planPreview),
    },
  });
};

export const validateInterviewPlan = (plan = {}) => ({
  schemaVersion: ensureString(plan.schemaVersion, 'v3'),
  candidateName: ensureString(plan.candidateName, 'Candidate'),
  jobTitle: ensureString(plan.jobTitle, 'Target Role'),
  matchScore: ensureNumber(plan.matchScore, 0),
  decision: normalizeDecision(plan.decision || {}),
  confidence: ensureNumber(plan.confidence, 0.4),
  requirementChecks: ensureArray(plan.requirementChecks),
  explanation: isObject(plan.explanation)
    ? {
        strengths: ensureArray(plan.explanation.strengths),
        gaps: ensureArray(plan.explanation.gaps),
        risks: ensureArray(plan.explanation.risks),
        summary: ensureString(plan.explanation.summary),
      }
    : buildExplanationObject(),
  interviewFocus: ensureArray(plan.interviewFocus),
  planPreview: ensureString(plan.planPreview),
  strategy: isObject(plan.strategy) ? plan.strategy : {},
  questionPool: ensureArray(plan.questionPool),
  fallbackRules: isObject(plan.fallbackRules) ? plan.fallbackRules : {},
  settingsSnapshot: isObject(plan.settingsSnapshot) ? plan.settingsSnapshot : {},
});

const normalizeSection = (section = {}, index = 0) => ({
  id: ensureString(section.id, `section_${index + 1}`),
  title: ensureString(section.title, `Section ${index + 1}`),
  content: ensureString(section.content),
});

export const validateReportOutput = (report = {}) => ({
  schemaVersion: ensureString(report.schemaVersion, 'v3'),
  id: ensureString(report.id, report.sessionId || ''),
  sessionId: ensureString(report.sessionId),
  candidateName: ensureString(report.candidateName, 'Candidate'),
  jobTitle: ensureString(report.jobTitle, 'Target Role'),
  generatedAt: ensureString(report.generatedAt, new Date().toISOString()),
  status: ensureString(report.status, 'draft'),
  summary: ensureString(report.summary),
  sections: ensureArray(report.sections).map(normalizeSection),
  scores: isObject(report.scores) ? report.scores : {},
  recommendations: ensureArray(report.recommendations).filter(Boolean),
  evidenceReferences: ensureArray(report.evidenceReferences),
});

export const validateReportQaOutput = (qa = {}) => ({
  schemaVersion: ensureString(qa.schemaVersion, 'v3'),
  reportId: ensureString(qa.reportId),
  status: ensureString(qa.status, qa.passed || qa.pass ? 'ready' : 'needs_review'),
  qualityFlags: ensureArray(qa.qualityFlags),
  consistencyChecks: ensureArray(qa.consistencyChecks),
  coverageScore: ensureNumber(qa.coverageScore, 0),
  hallucinationRisk: ensureString(qa.hallucinationRisk, 'unknown'),
  passed: Boolean(qa.passed ?? qa.pass),
});
