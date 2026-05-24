/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: schemaValidationService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { buildAnalyzeOutput, buildExplanationObject } from './scoringSchemaService.js';

/**
 * Purpose: Execute the main responsibility for isObject.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const ensureArray = (value) => (Array.isArray(value) ? value : []);
const ensureNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
/**
 * Purpose: Execute the main responsibility for ensureString.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const ensureString = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

const normalizeDecision = (decision = {}) => ({
  label: ensureString(decision.label, 'manual_review'),
  reasonCodes: ensureArray(decision.reasonCodes).filter(Boolean),
});

/**
 * Purpose: Execute the main responsibility for validateAnalyzeOutput.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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
      interviewFocus: ensureArray(safePayload.interviewFocus || safePayload.legacy?.interviewFocus),
      planPreview: ensureString(safePayload.planPreview || safePayload.legacy?.planPreview),
    },
  });
};

/**
 * Purpose: Execute the main responsibility for validateInterviewPlan.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for normalizeSection.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const normalizeSection = (section = {}, index = 0) => ({
  id: ensureString(section.id, `section_${index + 1}`),
  title: ensureString(section.title, `Section ${index + 1}`),
  content: ensureString(section.content),
});

/**
 * Purpose: Execute the main responsibility for normalizeCandidateFeedbackItem.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const normalizeCandidateFeedbackItem = (item = {}) => ({
  id: ensureString(item.id),
  label: ensureString(item.label),
  title: ensureString(item.title),
  theme: ensureString(item.theme),
  value: ensureNumber(item.value, 0),
  interpretation: ensureString(item.interpretation),
  explanation: ensureString(item.explanation),
  whyItMatters: ensureString(item.whyItMatters),
  action: ensureString(item.action),
  advice: ensureString(item.advice),
  example: ensureString(item.example),
  weak: ensureString(item.weak),
  better: ensureString(item.better),
  quote: ensureString(item.quote),
  context: ensureString(item.context),
  critique: ensureString(item.critique),
  rewrite: ensureString(item.rewrite),
  description: ensureString(item.description),
});

const normalizeScoreExplanation = (item = {}) => ({
  summary: ensureString(item.summary),
  helped: ensureString(item.helped),
  lowered: ensureString(item.lowered),
  next: ensureString(item.next),
});

const normalizeScoreExplanations = (value = {}) => ({
  overall: normalizeScoreExplanation(value.overall),
  cvJdMatch: normalizeScoreExplanation(value.cvJdMatch),
  interview: normalizeScoreExplanation(value.interview),
});

const normalizeDimensionReasons = (value = {}) => ({
  business: ensureString(value.business),
  logic: ensureString(value.logic),
  evidence: ensureString(value.evidence),
});

const normalizeTurnBreakdown = (item = {}) => ({
  question: ensureString(item.question),
  answer: ensureString(item.answer),
  feedback: ensureString(item.feedback),
  scores: isObject(item.scores) 
    ? {
        business: ensureNumber(item.scores.business, 0),
        logic: ensureNumber(item.scores.logic, 0),
        evidence: ensureNumber(item.scores.evidence, 0),
      }
    : { business: 0, logic: 0, evidence: 0 },
  dimensionReasons: normalizeDimensionReasons(item.dimensionReasons || item.scoreReasons),
});

const normalizeNzWorkplaceDimension = (item = {}) => ({
  id: ensureString(item.id),
  label: ensureString(item.label),
  score: ensureNumber(item.score, 0),
  observed: Boolean(item.observed),
  riskDetected: Boolean(item.riskDetected),
  evidenceQuote: ensureString(item.evidenceQuote),
  riskQuote: ensureString(item.riskQuote),
  feedback: ensureString(item.feedback),
});

const normalizeNzWorkplaceEvidence = (item = {}) => ({
  dimension: ensureString(item.dimension),
  quote: ensureString(item.quote),
  signal: ensureString(item.signal),
});

const normalizeNzSuggestedRewrite = (item = null) => isObject(item)
  ? {
      weak: ensureString(item.weak),
      better: ensureString(item.better),
      reason: ensureString(item.reason),
    }
  : null;

const normalizeNzWorkplaceFit = (value = {}) => ({
  enabled: Boolean(value.enabled),
  score: Number.isFinite(Number(value.score)) ? Number(value.score) : null,
  summary: ensureString(value.summary),
  dimensionScores: ensureArray(value.dimensionScores).map(normalizeNzWorkplaceDimension),
  strengths: ensureArray(value.strengths).filter(Boolean),
  gaps: ensureArray(value.gaps).filter(Boolean),
  evidence: ensureArray(value.evidence).map(normalizeNzWorkplaceEvidence),
  suggestedRewrite: normalizeNzSuggestedRewrite(value.suggestedRewrite),
});

const normalizeCompanyMotivationSignal = (value = {}) => ({
  score: ensureNumber(value.score, 0),
  comment: ensureString(value.comment),
});

const normalizeCompanyMotivationFit = (value = {}) => ({
  source: ensureString(value.source, 'general_fallback'),
  score: ensureNumber(value.score, 0),
  summary: ensureString(value.summary),
  matchedValues: ensureArray(value.matchedValues).map((item) => ({
    value: ensureString(item.value),
    candidateQuote: ensureString(item.candidateQuote),
    comment: ensureString(item.comment),
  })),
  missingValues: ensureArray(value.missingValues).map((item) => ({
    value: ensureString(item.value),
    whyItMatters: ensureString(item.whyItMatters),
    suggestion: ensureString(item.suggestion),
  })),
  candidateResearchSignal: normalizeCompanyMotivationSignal(value.candidateResearchSignal),
  roleMotivationSignal: normalizeCompanyMotivationSignal(value.roleMotivationSignal),
  suggestedRewrite: ensureString(value.suggestedRewrite),
  fallbackReason: ensureString(value.fallbackReason),
  evidenceStrength: ensureString(value.evidenceStrength),
});

/**
 * Purpose: Execute the main responsibility for validateReportOutput.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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
  interviewMetrics: isObject(report.interviewMetrics) ? report.interviewMetrics : {},
  evidenceDiagnostics: isObject(report.evidenceDiagnostics) ? report.evidenceDiagnostics : {},
  nzWorkplaceFit: normalizeNzWorkplaceFit(report.nzWorkplaceFit || {}),
  companyMotivationFit: normalizeCompanyMotivationFit(report.companyMotivationFit || {}),
  candidateFeedback: isObject(report.candidateFeedback)
    ? {
        overallTakeaway: ensureString(report.candidateFeedback.overallTakeaway),
        scoreBand: ensureString(report.candidateFeedback.scoreBand),
        generationSource: ensureString(report.candidateFeedback.generationSource),
        scoreExplanations: normalizeScoreExplanations(report.candidateFeedback.scoreExplanations || {}),
        communicationProfile: isObject(report.candidateFeedback.communicationProfile)
          ? {
              summary: ensureString(report.candidateFeedback.communicationProfile.summary),
              keyTraits: ensureArray(report.candidateFeedback.communicationProfile.keyTraits).map(normalizeCandidateFeedbackItem),
              fillerWords: ensureString(report.candidateFeedback.communicationProfile.fillerWords),
            }
          : { summary: '', keyTraits: [], fillerWords: '' },
        plainEnglishMetrics: ensureArray(report.candidateFeedback.plainEnglishMetrics).map(normalizeCandidateFeedbackItem),
        strengthHighlights: ensureArray(report.candidateFeedback.strengthHighlights).map(normalizeCandidateFeedbackItem),
        improvementPriorities: ensureArray(report.candidateFeedback.improvementPriorities).map(normalizeCandidateFeedbackItem),
        coachingAdvice: ensureArray(report.candidateFeedback.coachingAdvice).map(normalizeCandidateFeedbackItem),
        answerRewriteExamples: ensureArray(report.candidateFeedback.answerRewriteExamples).map(normalizeCandidateFeedbackItem),
        quoteAnalyses: ensureArray(report.candidateFeedback.quoteAnalyses).map(normalizeCandidateFeedbackItem),
        turnBreakdowns: ensureArray(report.candidateFeedback.turnBreakdowns).map(normalizeTurnBreakdown),
      }
    : {
        overallTakeaway: '',
        scoreBand: '',
        generationSource: '',
        scoreExplanations: normalizeScoreExplanations({}),
        communicationProfile: { summary: '', keyTraits: [], fillerWords: '' },
        plainEnglishMetrics: [],
        strengthHighlights: [],
        improvementPriorities: [],
        coachingAdvice: [],
        answerRewriteExamples: [],
        quoteAnalyses: [],
        turnBreakdowns: [],
      },
});

/**
 * Purpose: Execute the main responsibility for validateReportQaOutput.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const validateReportQaOutput = (qa = {}) => ({
  schemaVersion: ensureString(qa.schemaVersion, 'v3'),
  reportId: ensureString(qa.reportId),
  status: ensureString(qa.status, qa.passed || qa.pass ? 'ready' : 'needs_review'),
  qualityFlags: ensureArray(qa.qualityFlags),
  consistencyChecks: ensureArray(qa.consistencyChecks),
  coverageScore: ensureNumber(qa.coverageScore, 0),
  hallucinationRisk: ensureString(qa.hallucinationRisk, 'unknown'),
  passed: Boolean(qa.passed ?? qa.pass),
  diagnostics: isObject(qa.diagnostics) ? qa.diagnostics : {},
});
