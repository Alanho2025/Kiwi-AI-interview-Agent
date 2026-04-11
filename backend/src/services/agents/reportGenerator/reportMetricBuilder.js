/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportMetricBuilder should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { getDecisionLabel } from './reportGeneratorShared.js';

/**
 * Purpose: Execute the main responsibility for buildCandidateTakeaway.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildCandidateTakeaway = ({ analysisResult, evidenceSummary, interviewMetrics }) => {
  const overallScore = Number(analysisResult.overallScore || 0);
  const evidenceStrength = Number(evidenceSummary.averageStrength || 0);
  const directTurns = Number(evidenceSummary.totals.direct_past_experience || 0);
  const hypotheticalTurns = Number(evidenceSummary.totals.hypothetical_understanding || 0);

  if (overallScore >= 80 && evidenceStrength >= 2.8) {
    return 'You come across as a strong fit for the role, with solid alignment and convincing examples from past work.';
  }

  if (overallScore >= 65 && directTurns >= hypotheticalTurns) {
    return 'You show good alignment with the role, and your next step is to make your strongest examples more specific and memorable.';
  }

  if (overallScore >= 45 && evidenceStrength < 2) {
    return 'You show partial fit for the role, but your answers need more real project evidence to feel convincing.';
  }

  if (!interviewMetrics.interviewCompletedByLimit && (interviewMetrics.plannedQuestionCount || 0) > 0) {
    return 'The interview captured some useful signals, but the full planned question set was not completed, so the feedback should be read as directional.';
  }

  if (hypotheticalTurns > 0) {
    return 'You show useful role understanding, but too many answers stayed theoretical instead of proving what you have already done.';
  }

  if (getDecisionLabel(analysisResult) === 'not_qualified') {
    return 'The report found role-critical gaps, so the main priority is building clearer evidence against the must-have requirements.';
  }

  return 'This interview shows some relevant signals, but you need stronger, more detailed examples to make your fit feel clear and credible.';
};

/**
 * Purpose: Execute the main responsibility for buildPlainEnglishMetrics.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildPlainEnglishMetrics = ({ analysisResult, evidenceSummary, interviewMetrics }) => {
  const overallScore = Number(analysisResult.overallScore || 0);
  const evidenceStrength = Number(evidenceSummary.averageStrength || 0);
  const directTurns = Number(evidenceSummary.totals.direct_past_experience || 0);
  const hypotheticalTurns = Number(evidenceSummary.totals.hypothetical_understanding || 0);
  const genericTurns = Number(evidenceSummary.totals.generic_filler || 0);
  const plannedQuestions = Number(interviewMetrics.plannedQuestionCount || 0);
  const askedQuestions = Number(interviewMetrics.interviewerQuestionCount || 0);

  return [
    {
      id: 'overall_fit',
      label: 'Overall role fit',
      value: overallScore,
      interpretation:
        overallScore >= 80
          ? 'Your profile and interview answers point to strong alignment with this role.'
          : overallScore >= 65
            ? 'You are reasonably aligned with the role, but there are still noticeable gaps to close.'
            : overallScore >= 45
              ? 'You have some relevant signals, but the case for fit is not strong yet.'
              : 'The current interview evidence does not yet support a strong match for this role.',
    },
    {
      id: 'evidence_strength',
      label: 'Evidence strength',
      value: evidenceStrength,
      interpretation:
        evidenceStrength >= 3
          ? 'Your answers usually included context, actions, and outcomes, which makes them persuasive.'
          : evidenceStrength >= 2
            ? 'Some answers had useful detail, but several still needed clearer actions or outcomes.'
            : 'Most answers were too general. You would benefit from using concrete project stories with measurable results.',
    },
    {
      id: 'direct_examples',
      label: 'Use of real examples',
      value: directTurns,
      interpretation:
        directTurns >= 4
          ? 'You regularly grounded your answers in past experience, which is exactly what interviewers look for.'
          : directTurns >= 2
            ? 'You used some real examples, but there is room to anchor more answers in work you have actually done.'
            : 'Very few answers were backed by direct past experience, which is likely reducing your credibility.',
    },
    {
      id: 'hypothetical_answers',
      label: 'Theoretical answers',
      value: hypotheticalTurns,
      interpretation:
        hypotheticalTurns === 0
          ? 'You stayed grounded in what you have done, not only what you might do.'
          : hypotheticalTurns <= 2
            ? 'A few answers sounded theoretical. Replacing them with real examples would make your story stronger.'
            : 'Too many answers leaned on theory or intent. Interviewers usually trust demonstrated experience more than hypothetical reasoning.',
    },
    {
      id: 'interview_completion',
      label: 'Interview completion',
      value: plannedQuestions > 0 ? Math.min(100, Math.round((askedQuestions / Math.max(plannedQuestions, 1)) * 100)) : askedQuestions,
      interpretation:
        plannedQuestions > 0 && askedQuestions === plannedQuestions
          ? 'You completed the planned interview flow, so this report reflects the full session.'
          : 'The interview did not fully match the planned flow, so some signals may be incomplete.',
    },
    {
      id: 'generic_answers',
      label: 'Generic answers',
      value: genericTurns,
      interpretation:
        genericTurns >= 4
          ? 'Several answers likely felt broad or surface-level. This is a strong signal to prepare sharper STAR-style examples.'
          : genericTurns > 0
            ? 'A few answers may have felt too broad. Tightening them with specifics would improve clarity and impact.'
            : 'Most answers had enough substance to avoid sounding generic.',
    },
  ];
};

/**
 * Purpose: Execute the main responsibility for buildStrengthHighlights.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildStrengthHighlights = ({ explanation = {} }) => (explanation.strengths || []).slice(0, 4).map((item) => ({
  title: item.label,
  explanation: 'This showed up as one of your clearer role-fit signals and is worth reinforcing with specific examples.',
}));
