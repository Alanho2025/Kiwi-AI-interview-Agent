/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: insights should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { formatNumber, hasReasoningOnlyTurns, titleCase } from './shared.js';

/**
 * Purpose: Execute the main responsibility for buildTakeaway.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildTakeaway = ({ report, qa, evidenceDiagnostics }) => {
  const overall = Number(report.scores?.overall || 0);
  const directTurns = Number(report.scores?.directEvidenceTurns || 0);
  const hypotheticalTurns = Number(report.scores?.hypotheticalTurns || 0);
  const evidenceStrength = Number(report.scores?.evidenceStrength || 0);
  const reasoningOnly = hasReasoningOnlyTurns(report);

  if (overall >= 80 && evidenceStrength >= 2.8) {
    return 'You come across as a strong fit for the role, with solid alignment and credible examples from past work.';
  }
  if (overall >= 65 && directTurns >= hypotheticalTurns) {
    return 'You show good role fit, and your next step is to make your strongest examples more specific and memorable.';
  }
  if (overall >= 45 && evidenceStrength < 2) {
    return reasoningOnly
      ? 'You show partial fit for the role, but your answers need clearer role-specific reasoning, risk controls, validation, and outcomes.'
      : 'You show partial fit for the role, but your answers need clearer role-specific evidence to feel convincing.';
  }
  if (!qa.passed && (qa.qualityFlags || []).includes('question_count_mismatch')) {
    return 'The interview captured some useful signals, but the flow was incomplete, so the report should be read with caution.';
  }
  if ((evidenceDiagnostics.totals?.hypothetical_understanding || 0) > 0 && !reasoningOnly) {
    return 'You understand the role at a high level, but too many answers stayed theoretical instead of proving what you have already done.';
  }
  return 'This report suggests a mixed performance: some role alignment is present, but the interview did not consistently show clear, job-ready evidence.';
};

/**
 * Purpose: Execute the main responsibility for buildDataInsights.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildDataInsights = ({ report, qa, interviewMetrics, evidenceDiagnostics }) => {
  const insights = [];
  const overall = Number(report.scores?.overall || 0);
  const evidenceStrength = Number(report.scores?.evidenceStrength || 0);
  const directTurns = Number(report.scores?.directEvidenceTurns || 0);
  const hypotheticalTurns = Number(report.scores?.hypotheticalTurns || 0);
  const plannedQuestions = Number(interviewMetrics.plannedQuestionCount || 0);
  const askedQuestions = Number(interviewMetrics.interviewerQuestionCount || 0);
  const genericTurns = Number(evidenceDiagnostics.totals?.generic_filler || 0);
  const reasoningOnly = hasReasoningOnlyTurns(report);

  insights.push({
    title: 'Overall role fit',
    metric: `${formatNumber(overall)}/100`,
    description: overall >= 80
      ? 'Your profile and answers point to strong alignment with the role.'
      : overall >= 65
        ? 'You are reasonably aligned with the role, but there are still noticeable gaps to close.'
        : overall >= 45
          ? 'You have some relevant signals, but the overall case for fit is not strong yet.'
          : 'The current interview evidence does not yet support a strong match for this role.',
  });

  insights.push({
    title: 'Evidence quality',
    metric: `${formatNumber(evidenceStrength)}/4`,
    description: evidenceStrength >= 3
      ? 'Your answers usually included context, actions, and outcomes, which makes them persuasive.'
      : evidenceStrength >= 2
        ? 'Some answers had useful detail, but several still needed clearer actions or outcomes.'
        : 'Most answers were too general. Use the applicable role-specific framework to make reasoning, validation, and outcomes explicit.',
  });

  if (reasoningOnly) {
    insights.push({
      title: 'Role-specific reasoning',
      metric: `${hypotheticalTurns} scenario or knowledge responses`,
      description: 'These answers are assessed on requirements, judgement, risk or quality controls, validation, and outcome rather than past-experience wording.',
    });
  } else {
    insights.push({
      title: 'Use of role-specific examples',
      metric: `${directTurns} direct examples`,
      description: directTurns >= 4
        ? 'You regularly grounded past-example answers in relevant work.'
        : 'Past-example answers would benefit from clearer evidence of what you actually did.',
    });
    insights.push({
      title: 'Theoretical answers',
      metric: `${hypotheticalTurns} hypothetical responses`,
      description: 'For questions that ask for past evidence, replace intent with a genuine role-specific example.',
    });
  }

  insights.push({
    title: 'Interview completion',
    metric: plannedQuestions ? `${askedQuestions}/${plannedQuestions}` : `${askedQuestions} answered`,
    description: plannedQuestions > 0 && askedQuestions === plannedQuestions
      ? 'You completed the planned interview flow, so the report reflects the full session.'
      : 'The interview did not cleanly match the planned flow, so some signals may be incomplete.',
  });

  if (genericTurns > 0) {
    insights.push({
      title: 'Answers that felt generic',
      metric: `${genericTurns} generic turns`,
      description: genericTurns >= 4
        ? 'Several answers likely sounded broad or surface-level. Use the framework for each question type to add specific reasoning and evidence.'
        : 'A few answers may have felt too broad. Tightening them with specifics would improve clarity and impact.',
    });
  }

  if (!qa.passed) {
    insights.push({
      title: 'Report reliability',
      metric: qa.hallucinationRisk ? titleCase(qa.hallucinationRisk) : 'Needs review',
      description: 'The QA layer found issues in the report structure or evidence coverage, so this report should be treated as directional rather than final.',
    });
  }

  return insights;
};
