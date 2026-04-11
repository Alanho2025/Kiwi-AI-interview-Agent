/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportDraftBuilder should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { joinLabels } from './reportGeneratorShared.js';

/**
 * Purpose: Execute the main responsibility for buildSummary.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildSummary = ({ analysisResult, evidenceSummary, interviewMetrics }) => {
  const direct = evidenceSummary.totals.direct_past_experience || 0;
  const adjacent = evidenceSummary.totals.indirect_adjacent_experience || 0;
  const hypothetical = evidenceSummary.totals.hypothetical_understanding || 0;
  const strengths = joinLabels(analysisResult.explanation?.strengths || [], 4);

  return `Decision: ${analysisResult.decision?.label || 'manual_review'}. Top matched areas: ${strengths || 'role fit, communication'}. Direct evidence turns: ${direct}. Adjacent evidence turns: ${adjacent}. Hypothetical turns: ${hypothetical}. Planned questions answered: ${Math.min(interviewMetrics.candidateTurnCount, interviewMetrics.plannedQuestionCount || interviewMetrics.candidateTurnCount)} of ${interviewMetrics.plannedQuestionCount || interviewMetrics.candidateTurnCount}.`;
};

/**
 * Purpose: Execute the main responsibility for buildGapText.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildGapText = ({ analysisResult, evidenceSummary, interviewMetrics }) => {
  const gaps = [];

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0) {
    gaps.push('Some answers relied on hypothetical or system-level understanding rather than direct past examples.');
  }

  if ((evidenceSummary.totals.indirect_adjacent_experience || 0) > 0) {
    gaps.push('Several answers were adjacent to the asked technology rather than direct role-specific evidence.');
  }

  if (!interviewMetrics.interviewCompletedByLimit) {
    gaps.push('The interview did not cleanly finish the planned question set.');
  }

  if (!gaps.length && (analysisResult.explanation?.gaps || []).length) {
    return joinLabels(analysisResult.explanation.gaps, 4);
  }

  return gaps.join(' ');
};

/**
 * Purpose: Execute the main responsibility for buildStrongEvidenceText.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildStrongEvidenceText = (evidenceSummary = {}) => {
  if (!evidenceSummary.strongestExamples?.length) {
    return 'No high-strength interview examples were captured.';
  }

  return evidenceSummary.strongestExamples
    .map((item, index) => `Example ${index + 1}: ${item}`)
    .join(' | ');
};

/**
 * Purpose: Execute the main responsibility for buildReportDraft.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildReportDraft = ({
  session = {},
  analysisResult = {},
  interviewPlan = {},
  retrievalBundle = null,
  explanation = {},
  evidenceSummary = {},
  interviewMetrics = {},
  candidateFeedback = {},
}) => {
  const strongEvidenceText = buildStrongEvidenceText(evidenceSummary);

  return {
    schemaVersion: 'v3',
    sessionId: session.id,
    candidateName: analysisResult.candidateName || session.candidateName || 'Candidate',
    jobTitle: analysisResult.jobTitle || session.targetRole || 'Target Role',
    generatedAt: new Date().toISOString(),
    summary: buildSummary({ analysisResult, evidenceSummary, interviewMetrics }),
    sections: [
      {
        id: 'match_overview',
        title: 'Match overview',
        content: `Overall score ${analysisResult.overallScore || 0}, confidence ${analysisResult.confidence || 0}. Decision: ${analysisResult.decision?.label || 'manual_review'}. Average evidence strength: ${evidenceSummary.averageStrength} out of 4.`,
      },
      {
        id: 'strengths',
        title: 'Strengths',
        content: explanation.strengths?.length
          ? `The clearest strengths were ${joinLabels(explanation.strengths)}. The strongest interview evidence showed real context, specific actions, validation steps, and measurable outcomes.`
          : 'No standout strengths were captured.',
      },
      {
        id: 'gaps',
        title: 'Gaps',
        content: buildGapText({ analysisResult, evidenceSummary, interviewMetrics }) || 'No major gaps were captured.',
      },
      {
        id: 'interview_observations',
        title: 'Interview observations',
        content: `The session recorded ${interviewMetrics.candidateTurnCount} candidate turns, ${interviewMetrics.interviewerQuestionCount} scored interviewer questions, and ${interviewMetrics.extraAiTurnCount} extra AI turns. Focus areas: ${(interviewPlan.interviewFocus || []).join(', ') || 'general role fit'}.`,
      },
      {
        id: 'evidence_quality',
        title: 'Evidence quality',
        content: `Direct past-experience turns: ${evidenceSummary.totals.direct_past_experience || 0}. Adjacent-experience turns: ${evidenceSummary.totals.indirect_adjacent_experience || 0}. Hypothetical-understanding turns: ${evidenceSummary.totals.hypothetical_understanding || 0}. Generic turns: ${evidenceSummary.totals.generic_filler || 0}.`,
      },
      {
        id: 'evidence_examples',
        title: 'Evidence examples',
        content: strongEvidenceText,
      },
    ],
    scores: {
      overall: analysisResult.overallScore || 0,
      macro: analysisResult.scoreBreakdown?.macro || 0,
      micro: analysisResult.scoreBreakdown?.micro || 0,
      requirements: analysisResult.scoreBreakdown?.requirements || 0,
      evidenceStrength: evidenceSummary.averageStrength,
      directEvidenceTurns: evidenceSummary.totals.direct_past_experience || 0,
      hypotheticalTurns: evidenceSummary.totals.hypothetical_understanding || 0,
    },
    recommendations: [
      (evidenceSummary.totals.hypothetical_understanding || 0) > 0
        ? 'Replace hypothetical wording with one real project example for each major technology question.'
        : 'Keep using concrete project examples with measurable outcomes.',
      interviewMetrics.interviewerQuestionCount !== (session.totalQuestions || interviewMetrics.interviewerQuestionCount)
        ? 'Align the interview flow so the number of asked questions matches the planned question count.'
        : 'Continue using STAR-style examples to tighten impact and outcome statements.',
    ],
    evidenceReferences: [
      ...(analysisResult.evidenceMap || []).slice(0, 5),
      ...((retrievalBundle?.items || []).slice(0, 3).map((item) => ({
        chunkId: item.chunkId,
        label: item.metadata?.label || item.sourceType,
        sourceType: item.sourceType,
      }))),
    ],
    interviewMetrics,
    evidenceDiagnostics: {
      totals: evidenceSummary.totals,
      averageStrength: evidenceSummary.averageStrength,
    },
    candidateFeedback,
  };
};
