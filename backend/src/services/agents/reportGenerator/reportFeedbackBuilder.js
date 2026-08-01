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


const firstLabel = (items = [], fallback = '') => items.find((item) => item?.title || item?.label || item?.action || item?.explanation)?.title
  || items.find((item) => item?.title || item?.label || item?.action || item?.explanation)?.label
  || items.find((item) => item?.title || item?.label || item?.action || item?.explanation)?.action
  || items.find((item) => item?.title || item?.label || item?.action || item?.explanation)?.explanation
  || fallback;

const buildScoreExplanations = ({ analysisResult = {}, evidenceSummary = {}, interviewMetrics = {}, explanation = {}, turnBreakdowns = [] }) => {
  const interviewScore = Number(evidenceSummary.averageStrength || 0) * 25;
  const averageEvidence = Number(evidenceSummary.averageStrength || 0);
  const strengths = buildStrengthHighlights({ explanation });
  const priorities = buildImprovementPriorities({ analysisResult, evidenceSummary, interviewMetrics, turnBreakdowns });
  const helped = firstLabel(strengths, 'Some role requirements match your CV and interview evidence.');
  const lowered = firstLabel(priorities, 'Some answers need clearer evidence and measurable outcomes.');

  return {
    overall: {
      summary: interviewScore >= 75 && averageEvidence >= 2.5 ? 'Your interview answers provide a strong base.' : 'The interview is useful, but stronger answer evidence would make it more convincing.',
      helped,
      lowered,
      next: 'Improve the weakest evidence gap first.',
    },
    interview: {
      summary: averageEvidence >= 2.5 ? 'Your interview answers include usable evidence.' : 'Your interview answers need clearer role-specific reasoning and evidence.',
      helped: 'Clear intent and relevant interview direction.',
      lowered,
      next: 'Use the framework shown for each question and make the validation and outcome explicit.',
    },
  };
};

/**
 * Purpose: Execute the main responsibility for buildDeterministicCandidateFeedback.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildDeterministicCandidateFeedback = ({ analysisResult, scores = {}, explanation, evidenceSummary, interviewMetrics, interviewPlan, turnBreakdowns = [] }) => ({
  overallTakeaway: buildCandidateTakeaway({ analysisResult, scores, evidenceSummary, interviewMetrics }),
  scoreBand: getScoreBand(scores.overall || 0),
  scoreExplanations: buildScoreExplanations({ analysisResult, evidenceSummary, interviewMetrics, explanation, turnBreakdowns }),
  plainEnglishMetrics: buildPlainEnglishMetrics({ analysisResult, scores, evidenceSummary, interviewMetrics }),
  strengthHighlights: buildStrengthHighlights({ explanation }),
  improvementPriorities: buildImprovementPriorities({ analysisResult, evidenceSummary, interviewMetrics, turnBreakdowns }),
  coachingAdvice: buildCoachingAdvice({ evidenceSummary, interviewPlan, turnBreakdowns }),
  answerRewriteExamples: buildAnswerRewriteExamples({ turnBreakdowns }),
  communicationProfile: { summary: '', keyTraits: [], fillerWords: '' },
  quoteAnalyses: [],
  turnBreakdowns,
});
