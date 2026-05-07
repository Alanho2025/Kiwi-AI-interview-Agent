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

const buildScoreExplanations = ({ analysisResult = {}, evidenceSummary = {}, interviewMetrics = {}, explanation = {} }) => {
  const cvScore = Number(analysisResult.overallScore || 0);
  const averageEvidence = Number(evidenceSummary.averageStrength || 0);
  const strengths = buildStrengthHighlights({ explanation });
  const priorities = buildImprovementPriorities({ analysisResult, evidenceSummary, interviewMetrics });
  const helped = firstLabel(strengths, 'Some role requirements match your CV and interview evidence.');
  const lowered = firstLabel(priorities, 'Some answers need clearer evidence and measurable outcomes.');

  return {
    overall: {
      summary: cvScore >= 75 && averageEvidence >= 2.5 ? 'Strong base across CV fit and interview evidence.' : 'The result is useful, but stronger evidence would make it more convincing.',
      helped,
      lowered,
      next: 'Improve the weakest evidence gap first.',
    },
    cvJdMatch: {
      summary: cvScore >= 75 ? 'Your CV matches several important JD signals.' : 'The CV-JD match needs clearer requirement-level proof.',
      helped,
      lowered: 'Some JD requirements are not clearly proven in the CV.',
      next: 'Rewrite CV bullets around must-have requirements.',
    },
    interview: {
      summary: averageEvidence >= 2.5 ? 'Your interview answers include usable evidence.' : 'Your interview answers need more direct project evidence.',
      helped: 'Clear intent and relevant interview direction.',
      lowered,
      next: 'Use STAR with one measurable result per answer.',
    },
  };
};

/**
 * Purpose: Execute the main responsibility for buildDeterministicCandidateFeedback.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildDeterministicCandidateFeedback = ({ analysisResult, explanation, evidenceSummary, interviewMetrics, interviewPlan }) => ({
  overallTakeaway: buildCandidateTakeaway({ analysisResult, evidenceSummary, interviewMetrics }),
  scoreBand: getScoreBand(analysisResult.overallScore || 0),
  scoreExplanations: buildScoreExplanations({ analysisResult, evidenceSummary, interviewMetrics, explanation }),
  plainEnglishMetrics: buildPlainEnglishMetrics({ analysisResult, evidenceSummary, interviewMetrics }),
  strengthHighlights: buildStrengthHighlights({ explanation }),
  improvementPriorities: buildImprovementPriorities({ analysisResult, evidenceSummary, interviewMetrics }),
  coachingAdvice: buildCoachingAdvice({ evidenceSummary, interviewPlan }),
  answerRewriteExamples: buildAnswerRewriteExamples({ evidenceSummary }),
  communicationProfile: { summary: '', keyTraits: [], fillerWords: '' },
  quoteAnalyses: [],
  turnBreakdowns: [],
});
