/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportGeneratorAgent should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { validateReportOutput } from '../schemaValidationService.js';
import { generateCandidateFeedback } from '../reportCoachingService.js';
import { analyseCandidateAnswers, buildEvidenceSummary, buildInterviewMetrics } from './reportGenerator/reportEvidenceAnalysis.js';
import { buildDeterministicCandidateFeedback } from './reportGenerator/reportFeedbackBuilder.js';
import { buildReportDraft } from './reportGenerator/reportDraftBuilder.js';

/**
 * Purpose: Execute the main responsibility for runReportGeneratorAgent.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const runReportGeneratorAgent = async ({ session = {}, analysisResult = {}, interviewPlan = {}, retrievalBundle = null } = {}) => {
  const transcript = session.transcript || [];
  const userTurns = transcript.filter((turn) => turn.role === 'user');
  const explanation = analysisResult.explanation || { strengths: [], gaps: [], risks: [], summary: '' };
  const analysedAnswers = analyseCandidateAnswers(userTurns);
  const evidenceSummary = buildEvidenceSummary(analysedAnswers);
  const interviewMetrics = buildInterviewMetrics(transcript, session.totalQuestions || 0);
  const deterministicFeedback = buildDeterministicCandidateFeedback({
    analysisResult,
    explanation,
    evidenceSummary,
    interviewMetrics,
    interviewPlan,
  });

  const candidateFeedback = await generateCandidateFeedback({
    session,
    analysisResult,
    interviewPlan,
    evidenceSummary,
    interviewMetrics,
    strongestExamples: evidenceSummary.strongestExamples,
    deterministicFeedback,
  });

  const draft = buildReportDraft({
    session,
    analysisResult,
    interviewPlan,
    retrievalBundle,
    explanation,
    evidenceSummary,
    interviewMetrics,
    candidateFeedback,
  });

  return validateReportOutput(draft);
};
