/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: coaching should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import {
  extractFocusAreas,
  getReportTurnBreakdowns,
  hasReasoningOnlyTurns,
} from './shared.js';

const hasConcisionEvidence = (metrics = {}) => Number(metrics.overlongAnswerCount || 0) > 0
  || Number(metrics.unfocusedAnswerCount || 0) > 0
  || Number(metrics.averageAnswerDurationSeconds || 0) > 90
  || Number(metrics.averageAnswerWordCount || 0) > 120;

/**
 * Purpose: Execute the main responsibility for buildFallbackImprovementPriorities.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildFallbackImprovementPriorities = ({ report, interviewMetrics, evidenceDiagnostics }) => {
  const focusAreas = extractFocusAreas(report.sections || []);
  const directTurns = Number(report.scores?.directEvidenceTurns || 0);
  const hypotheticalTurns = Number(report.scores?.hypotheticalTurns || 0);
  const evidenceStrength = Number(report.scores?.evidenceStrength || 0);
  const genericTurns = Number(evidenceDiagnostics.totals?.generic_filler || 0);
  const advice = [];
  const reasoningOnly = hasReasoningOnlyTurns(report);

  if (hypotheticalTurns > 0 && reasoningOnly) {
    advice.push({
      title: 'Make professional reasoning explicit',
      detail: 'Scenario and knowledge answers should state requirements, options, judgement, risk or quality controls, validation, and outcome.',
      example: 'Use this sequence: requirements, options, judgement, risk or quality controls, validation, and expected outcome.',
    });
  } else if (hypotheticalTurns > 0) {
    advice.push({
      title: 'Replace theory with proof',
      detail: 'When a question asks for a past example, lead with relevant work you actually completed.',
      example: 'Use this sequence: actual context, your approach and judgement, risk controls, validation, and the actual outcome.',
    });
  }
  if (evidenceStrength < 2.2) {
    advice.push({
      title: 'Add action and outcome to every answer',
      detail: 'Your answers will sound stronger if each one includes what you personally did and what changed because of it.',
      example: 'Use this pattern: "The challenge was..., I handled..., and the result was..."',
    });
  }
  if (directTurns < 3 && !reasoningOnly) {
    advice.push({
      title: 'Prepare 3 reusable story banks',
      detail: 'Before the next interview, prepare three genuine stories that show role-specific judgement, teamwork, and ownership.',
      example: 'Pick one delivery example, one problem-solving example, and one collaboration example, then practise each in under 90 seconds.',
    });
  }
  if (genericTurns >= 3) {
    advice.push({
      title: 'Reduce broad or generic wording',
      detail: 'Avoid broad claims. Explain your judgement, trade-offs, safeguards, verification, and outcome.',
      example: 'Swap "quality is important" for "I checked [actual criterion] using [actual verification method] and responded with [actual action]."',
    });
  }
  if (hasConcisionEvidence(interviewMetrics)) {
    advice.push({
      title: 'Practise concise answers',
      detail: 'Keeping answers focused can help the interview stay on track and make your strongest evidence easier to notice.',
      example: 'Aim for 60-90 second core answers, then expand only when the interviewer asks for more detail.',
    });
  }
  if (focusAreas.length > 0) {
    advice.push({
      title: 'Target the role-specific gaps',
      detail: `The interview repeatedly touched on ${focusAreas.slice(0, 3).join(', ')}. These are the themes you should strengthen first.`,
      example: `Prepare one example for each of these areas: ${focusAreas.slice(0, 3).join(', ')}.`,
    });
  }
  if (!advice.length) {
    advice.push({
      title: 'Keep building specificity',
      detail: 'You already have a workable base. The biggest gain now will come from sharper examples and clearer impact statements.',
      example: 'For each key role requirement, prepare one sentence on the context, one on your approach, and one on the outcome.',
    });
  }

  return advice.slice(0, 4);
};

/**
 * Purpose: Execute the main responsibility for buildFallbackCoachingAdvice.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildFallbackCoachingAdvice = ({ report, interviewMetrics, evidenceDiagnostics }) =>
  buildFallbackImprovementPriorities({ report, interviewMetrics, evidenceDiagnostics }).map((item) => ({
    theme: item.title,
    advice: item.detail,
    example: item.example,
  }));

/**
 * Purpose: Execute the main responsibility for buildFallbackAnswerRewriteTips.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildFallbackAnswerRewriteTips = ({ report }) => {
  const turns = getReportTurnBreakdowns(report);
  const failureReason = 'A grounded stronger answer could not be generated reliably. Regenerate the report to try again.';
  const suggestions = turns
    .filter((turn) => String(turn.answer || '').trim())
    .slice(0, 3)
    .map((turn) => ({
      status: 'unavailable',
      failureReason,
      question: String(turn.question || ''),
      weak: String(turn.answer).trim(),
      better: '',
    }));

  if (!suggestions.length) {
    suggestions.push({
      status: 'unavailable',
      failureReason,
      question: '',
      weak: 'The answer stayed broad and did not include enough role-specific evidence.',
      better: '',
    });
  }

  return suggestions.slice(0, 3);
};

/**
 * Purpose: Execute the main responsibility for buildFallbackStrengthHighlights.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildFallbackStrengthHighlights = (report = {}) => {
  const strengthsSection = report.sections?.find((section) => section.id === 'strengths');
  const labels = String(strengthsSection?.content || '')
    .match(/The clearest strengths were (.+?)\./)?.[1]
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) || [];

  return labels.slice(0, 4);
};
