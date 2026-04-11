/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportFeedbackBuilder should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { getScoreBand } from './reportGeneratorShared.js';
import { buildCandidateTakeaway, buildPlainEnglishMetrics, buildStrengthHighlights } from './reportMetricBuilder.js';
import { buildImprovementPriorities, buildCoachingAdvice, buildAnswerRewriteExamples } from './reportCoachingBuilder.js';

/**
 * Purpose: Execute the main responsibility for buildDeterministicCandidateFeedback.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildDeterministicCandidateFeedback = ({ analysisResult, explanation, evidenceSummary, interviewMetrics, interviewPlan }) => ({
  overallTakeaway: buildCandidateTakeaway({ analysisResult, evidenceSummary, interviewMetrics }),
  scoreBand: getScoreBand(analysisResult.overallScore || 0),
  plainEnglishMetrics: buildPlainEnglishMetrics({ analysisResult, evidenceSummary, interviewMetrics }),
  strengthHighlights: buildStrengthHighlights({ explanation }),
  improvementPriorities: buildImprovementPriorities({ analysisResult, evidenceSummary, interviewMetrics }),
  coachingAdvice: buildCoachingAdvice({ evidenceSummary, interviewPlan }),
  answerRewriteExamples: buildAnswerRewriteExamples({ evidenceSummary }),
});
