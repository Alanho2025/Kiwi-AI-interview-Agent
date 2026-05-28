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
import {
  DEFAULT_SCHEMA_VERSION,
  DEFAULT_CANDIDATE_NAME,
  DEFAULT_JOB_TITLE,
  DEFAULT_CONFIDENCE,
} from '../config/schemaValidationConstants.js';
import {
  isObject,
  ensureArray,
  ensureNumber,
  ensureString,
  normalizeDecision,
  normalizeSection,
  normalizeCandidateFeedbackItem,
  normalizeScoreExplanations,
  normalizeTurnBreakdown,
  normalizeNzWorkplaceFit,
  normalizeCompanyMotivationFit,
  normalizeVoiceDeliverySummary,
} from '../utils/schemaHelpers.js';

/**
 * Purpose: Execute the main responsibility for validateAnalyzeOutput.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const validateAnalyzeOutput = (payload = {}) => {
  const safePayload = isObject(payload) ? payload : {};
  return buildAnalyzeOutput({
    candidateName: ensureString(safePayload.candidateName, DEFAULT_CANDIDATE_NAME),
    jobTitle: ensureString(safePayload.jobTitle, DEFAULT_JOB_TITLE),
    overallScore: ensureNumber(safePayload.overallScore ?? safePayload.matchScore, 0),
    confidence: ensureNumber(safePayload.confidence, DEFAULT_CONFIDENCE),
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
  schemaVersion: ensureString(plan.schemaVersion, DEFAULT_SCHEMA_VERSION),
  candidateName: ensureString(plan.candidateName, DEFAULT_CANDIDATE_NAME),
  jobTitle: ensureString(plan.jobTitle, DEFAULT_JOB_TITLE),
  matchScore: ensureNumber(plan.matchScore, 0),
  decision: normalizeDecision(plan.decision || {}),
  confidence: ensureNumber(plan.confidence, DEFAULT_CONFIDENCE),
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
 * Purpose: Execute the main responsibility for validateReportOutput.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const validateReportOutput = (report = {}) => ({
  schemaVersion: ensureString(report.schemaVersion, DEFAULT_SCHEMA_VERSION),
  id: ensureString(report.id, report.sessionId || ''),
  sessionId: ensureString(report.sessionId),
  candidateName: ensureString(report.candidateName, DEFAULT_CANDIDATE_NAME),
  jobTitle: ensureString(report.jobTitle, DEFAULT_JOB_TITLE),
  generatedAt: ensureString(report.generatedAt, new Date().toISOString()),
  status: ensureString(report.status, 'draft'),
  summary: ensureString(report.summary),
  sections: ensureArray(report.sections).map(normalizeSection),
  scores: isObject(report.scores) ? report.scores : {},
  recommendations: ensureArray(report.recommendations).filter(Boolean),
  evidenceReferences: ensureArray(report.evidenceReferences),
  interviewMetrics: isObject(report.interviewMetrics) ? report.interviewMetrics : {},
  evidenceDiagnostics: isObject(report.evidenceDiagnostics) ? report.evidenceDiagnostics : {},
  traceSummary: isObject(report.traceSummary) ? report.traceSummary : {},
  nzWorkplaceFit: normalizeNzWorkplaceFit(report.nzWorkplaceFit || {}),
  voiceDeliverySummary: normalizeVoiceDeliverySummary(report.voiceDeliverySummary || {}),
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
  schemaVersion: ensureString(qa.schemaVersion, DEFAULT_SCHEMA_VERSION),
  reportId: ensureString(qa.reportId),
  status: ensureString(qa.status, qa.passed || qa.pass ? 'ready' : 'needs_review'),
  qualityFlags: ensureArray(qa.qualityFlags),
  consistencyChecks: ensureArray(qa.consistencyChecks),
  coverageScore: ensureNumber(qa.coverageScore, 0),
  hallucinationRisk: ensureString(qa.hallucinationRisk, 'unknown'),
  passed: Boolean(qa.passed ?? qa.pass),
  diagnostics: isObject(qa.diagnostics) ? qa.diagnostics : {},
});

// Made with Bob
