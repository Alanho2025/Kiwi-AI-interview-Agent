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

/**
 * Purpose: Execute the main responsibility for buildCandidateTakeaway.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildCandidateTakeaway = ({ scores = {}, evidenceSummary, interviewMetrics }) => {
  const overallScore = Number(scores.overall || 0);
  const evidenceStrength = Number(evidenceSummary.averageStrength || 0);
  const directTurns = Number(evidenceSummary.totals.direct_past_experience || 0);
  const hypotheticalTurns = Number(evidenceSummary.totals.hypothetical_understanding || 0);

  if (overallScore >= 80 && evidenceStrength >= 2.8) {
    return 'Your interview answers were strong, with convincing examples from past work.';
  }

  if (overallScore >= 65 && directTurns >= hypotheticalTurns) {
    return 'Your answers were effective overall, and your next step is to make the strongest examples more specific and memorable.';
  }

  if (overallScore >= 45 && evidenceStrength < 2) {
    return 'Your answers show some useful evidence, but they need more real project detail to feel convincing.';
  }

  if (!interviewMetrics.interviewCompletedByLimit && (interviewMetrics.plannedQuestionCount || 0) > 0) {
    return 'The interview captured some useful signals, but the full planned question set was not completed, so the feedback should be read as directional.';
  }

  if (hypotheticalTurns > 0) {
    return 'You show useful role understanding, but too many answers stayed theoretical instead of proving what you have already done.';
  }

  return 'This interview shows some useful signals, but you need stronger, more detailed examples to make your answers clear and credible.';
};

/**
 * Purpose: Execute the main responsibility for buildPlainEnglishMetrics.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildPlainEnglishMetrics = ({ scores = {}, evidenceSummary, interviewMetrics }) => {
  const overallScore = Number(scores.overall || 0);
  const evidenceStrength = Number(evidenceSummary.averageStrength || 0);
  const directTurns = Number(evidenceSummary.totals.direct_past_experience || 0);
  const hypotheticalTurns = Number(evidenceSummary.totals.hypothetical_understanding || 0);
  const genericTurns = Number(evidenceSummary.totals.generic_filler || 0);
  const plannedQuestions = Number(interviewMetrics.plannedQuestionCount || 0);
  const answeredQuestions = Number(interviewMetrics.scoredCandidateAnswerCount || interviewMetrics.candidateTurnCount || 0);
  const completionPercent = plannedQuestions > 0
    ? Math.min(100, Math.round((answeredQuestions / Math.max(plannedQuestions, 1)) * 100))
    : answeredQuestions;

  return [
    {
      id: 'interview_performance',
      label: 'Interview performance',
      value: overallScore,
      displayValue: `${overallScore.toFixed(2)}/100`,
      unit: 'score',
      interpretation:
        overallScore >= 80
          ? 'Your answers consistently used clear reasoning and convincing evidence.'
          : overallScore >= 65
            ? 'Your answers were reasonably clear, but there are still noticeable gaps to close.'
            : overallScore >= 45
              ? 'You have some useful signals, but the answer quality is not strong yet.'
              : 'The current interview evidence does not yet support a strong performance assessment.',
    },
    {
      id: 'evidence_strength',
      label: 'Evidence strength',
      value: evidenceStrength,
      displayValue: `${evidenceStrength.toFixed(2)}/4`,
      unit: 'score',
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
      displayValue: `${directTurns} turn${directTurns === 1 ? '' : 's'}`,
      unit: 'turns',
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
      displayValue: `${hypotheticalTurns} turn${hypotheticalTurns === 1 ? '' : 's'}`,
      unit: 'turns',
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
      value: completionPercent,
      displayValue: plannedQuestions > 0 ? `${answeredQuestions}/${plannedQuestions} answered` : `${answeredQuestions} answered`,
      unit: plannedQuestions > 0 ? 'ratio' : 'turns',
      interpretation:
        plannedQuestions > 0 && answeredQuestions === plannedQuestions
          ? 'You completed the planned interview flow, so this report reflects the full session.'
          : 'The interview did not fully match the planned flow, so some signals may be incomplete.',
    },
    {
      id: 'generic_answers',
      label: 'Generic answers',
      value: genericTurns,
      displayValue: `${genericTurns} turn${genericTurns === 1 ? '' : 's'}`,
      unit: 'turns',
      interpretation:
        genericTurns >= 4
          ? 'Several answers likely felt broad or surface-level. This is a strong signal to prepare sharper framework-based answers.'
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
