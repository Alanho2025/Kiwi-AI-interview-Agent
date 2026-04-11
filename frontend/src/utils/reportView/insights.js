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

import { formatNumber, titleCase } from './shared.js';

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

  if (overall >= 80 && evidenceStrength >= 2.8) {
    return 'You come across as a strong fit for the role, with solid alignment and credible examples from past work.';
  }
  if (overall >= 65 && directTurns >= hypotheticalTurns) {
    return 'You show good role fit, and your next step is to make your strongest examples more specific and memorable.';
  }
  if (overall >= 45 && evidenceStrength < 2) {
    return 'You show partial fit for the role, but your answers need more real project evidence to feel convincing.';
  }
  if (!qa.passed && (qa.qualityFlags || []).includes('question_count_mismatch')) {
    return 'The interview captured some useful signals, but the flow was incomplete, so the report should be read with caution.';
  }
  if ((evidenceDiagnostics.totals?.hypothetical_understanding || 0) > 0) {
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
        : 'Most answers were too general. You would benefit from using concrete project stories with measurable results.',
  });

  insights.push({
    title: 'Use of real examples',
    metric: `${directTurns} direct examples`,
    description: directTurns >= 4
      ? 'You regularly grounded your answers in past experience, which is exactly what interviewers look for.'
      : directTurns >= 2
        ? 'You used some real examples, but there is room to anchor more answers in work you have actually done.'
        : 'Very few answers were backed by direct past experience. This is likely reducing your credibility in the interview.',
  });

  insights.push({
    title: 'Theoretical answers',
    metric: `${hypotheticalTurns} hypothetical responses`,
    description: hypotheticalTurns === 0
      ? 'You stayed grounded in what you have done, not only what you might do.'
      : hypotheticalTurns <= 2
        ? 'A few answers sounded theoretical. Replacing them with real examples would make your story stronger.'
        : 'Too many answers leaned on theory or intent. Interviewers usually trust demonstrated experience more than hypothetical reasoning.',
  });

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
        ? 'Several answers likely sounded broad or surface-level. This is a strong sign that you should prepare sharper STAR-style examples.'
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
