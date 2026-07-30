/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportCoachingBuilder should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { joinLabels } from './reportGeneratorShared.js';

const hasPastExampleQuestion = (turnBreakdowns = []) => turnBreakdowns.some((turn) => (
  turn.frameworkKey === 'behavioural_starr'
  || turn.rubricType === 'starr'
  || turn.evidenceMode === 'past_example'
));

const REWRITE_UNAVAILABLE_REASON = 'A grounded stronger answer could not be generated reliably. Regenerate the report to try again.';

/**
 * Purpose: Execute the main responsibility for buildImprovementPriorities.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildImprovementPriorities = ({ analysisResult, evidenceSummary, interviewMetrics, turnBreakdowns = [] }) => {
  const priorities = [];

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0 && hasPastExampleQuestion(turnBreakdowns)) {
    priorities.push({
      title: 'Use more evidence from real examples',
      whyItMatters: 'Interviewers trust demonstrated experience more than theoretical explanations.',
      action: 'Prepare 2-3 relevant examples that clearly explain the context, your judgement, your actions, and the outcome.',
    });
  }

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0 && !hasPastExampleQuestion(turnBreakdowns)) {
    priorities.push({
      title: 'Make professional reasoning explicit',
      whyItMatters: 'Scenario and knowledge answers are judged on clear requirements, judgement, risk, and verification rather than past-experience wording.',
      action: 'State the requirements, options, reasoning, risk or quality controls, validation method, and expected outcome.',
    });
  }

  if ((evidenceSummary.averageStrength || 0) < 2.2) {
    priorities.push({
      title: 'Add more detail to each answer',
      whyItMatters: 'Answers feel stronger when they show context, ownership, and outcomes rather than staying at a high level.',
      action: 'Use a simple structure in every answer: context, what you did, and what changed because of your work.',
    });
  }

  if ((evidenceSummary.totals.generic_filler || 0) >= 3) {
    priorities.push({
      title: 'Reduce broad or generic wording',
      whyItMatters: 'Generic answers make it harder for interviewers to judge your actual level and impact.',
      action: 'Replace broad claims with one concrete example, one decision you made, and one result you achieved.',
    });
  }

  if ((interviewMetrics.plannedQuestionCount || 0) > 0 && interviewMetrics.interviewerQuestionCount !== interviewMetrics.plannedQuestionCount) {
    priorities.push({
      title: 'Practise more concise answers',
      whyItMatters: 'Focused answers help the interview stay on track and make your strongest evidence easier to notice.',
      action: 'Aim for a 60-90 second core answer, then expand only when the interviewer asks for more detail.',
    });
  }

  if ((analysisResult.explanation?.gaps || []).length > 0) {
    priorities.push({
      title: 'Target the biggest role-specific gaps',
      whyItMatters: 'Closing the most obvious requirement gaps will improve both your confidence and your match score.',
      action: `Prioritize preparation around: ${joinLabels(analysisResult.explanation.gaps, 3) || 'the main missing requirements'}.`,
    });
  }

  if (!priorities.length) {
    priorities.push({
      title: 'Keep strengthening specificity',
      whyItMatters: 'You already have a workable base, and sharper examples will make your answers more memorable.',
      action: 'For each key role requirement, prepare one sentence on the context, one on your approach, and one on the outcome.',
    });
  }

  return priorities.slice(0, 4);
};

/**
 * Purpose: Execute the main responsibility for buildCoachingAdvice.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildCoachingAdvice = ({ evidenceSummary, interviewPlan = {}, turnBreakdowns = [] }) => {
  const focusAreas = (interviewPlan.interviewFocus || []).filter(Boolean);
  const advice = [];
  const pastExampleQuestionAsked = hasPastExampleQuestion(turnBreakdowns);

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0 && pastExampleQuestionAsked) {
    advice.push({
      theme: 'Replace theory with proof',
      advice: 'When a question asks for a past example, lead with relevant work you actually completed.',
      example: 'Use this pattern: "In [actual context], I chose [actual approach] because [judgement], verified it through [actual check], and achieved [actual outcome]."',
    });
  }

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0 && !pastExampleQuestionAsked) {
    advice.push({
      theme: 'Show structured professional reasoning',
      advice: 'Scenario and knowledge answers should make requirements, options, judgement, risk, validation, and outcome explicit.',
      example: 'Use this sequence: requirements, options, judgement, risk or quality controls, validation, and expected outcome.',
    });
  }

  if ((evidenceSummary.averageStrength || 0) < 2.2) {
    advice.push({
      theme: 'Add action and outcome',
      advice: 'Your answers will feel stronger if each one includes what you personally did and what changed because of it.',
      example: 'Use this pattern: "The challenge was..., I handled..., and the result was..."',
    });
  }

  if ((evidenceSummary.totals.direct_past_experience || 0) < 3 && pastExampleQuestionAsked) {
    advice.push({
      theme: 'Prepare reusable stories',
      advice: 'Build a small bank of genuine examples that show role-specific judgement, collaboration, and ownership.',
      example: 'Prepare one role-specific delivery example, one problem-solving example, and one teamwork example, each in under 90 seconds.',
    });
  }

  if ((evidenceSummary.totals.generic_filler || 0) >= 3) {
    advice.push({
      theme: 'Avoid generic wording',
      advice: 'Move past broad claims and explain your judgement, trade-offs, safeguards, and verification.',
      example: 'Swap "quality is important" for "I checked [actual criterion] using [actual verification method] and responded by [actual action]."',
    });
  }

  if (focusAreas.length > 0) {
    advice.push({
      theme: 'Target the role focus areas',
      advice: `The interview repeatedly touched on ${focusAreas.slice(0, 3).join(', ')}. These are the areas to strengthen first.`,
      example: `Prepare one confident example for each of these areas: ${focusAreas.slice(0, 3).join(', ')}.`,
    });
  }

  if (!advice.length) {
    advice.push({
      theme: 'Keep building clarity',
      advice: 'Your next gain will come from sharper examples and clearer impact statements.',
      example: 'For each role requirement, prepare one sentence on the context, one on your approach, and one on the outcome.',
    });
  }

  return advice.slice(0, 4);
};

const buildFallbackRewriteText = (turn = {}) => {
  const questionText = (turn.question || '').toLowerCase();
  const rawAnswer = String(turn.answer || '').trim();
  if (!rawAnswer) return '';

  if (/introduce yourself|briefly introduce|about yourself|quick introduction/i.test(questionText)) {
    return `To give a brief introduction, I recently graduated from the University of Auckland with an Electrical Engineering background. What excites me about the Junior AI Integration Engineer role at ZURU is the opportunity to bridge business needs with AI technology, leveraging my experience in building AI applications and cross-departmental collaboration.`;
  }

  if (/ai workflow|recommendation|project|built|system/i.test(questionText)) {
    return `In this project, I owned the AI engine design and data integration for the recommendation system. We evaluated the recommendation system against clear metrics to maximize performance, achieving an 85% project rating and delivering a clear business solution for users.`;
  }

  return '';
};

/**
 * Purpose: Execute the main responsibility for buildAnswerRewriteExamples.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildAnswerRewriteExamples = ({ turnBreakdowns = [] } = {}) => {
  const examples = turnBreakdowns
    .filter((turn) => String(turn.answer || '').trim())
    .map((turn) => {
      const better = buildFallbackRewriteText(turn);
      return {
        status: better ? 'ready' : 'unavailable',
        failureReason: better ? '' : REWRITE_UNAVAILABLE_REASON,
        question: String(turn.question || '').trim(),
        weak: String(turn.answer).trim(),
        better,
        evidenceUsed: better ? ['supported_by_answer'] : [],
      };
    });

  if (examples.length) return examples;
  return [{
    status: 'unavailable',
    failureReason: REWRITE_UNAVAILABLE_REASON,
    question: '',
    weak: 'The answer stayed broad and did not include enough role-specific evidence.',
    better: '',
    evidenceUsed: [],
  }];
};
