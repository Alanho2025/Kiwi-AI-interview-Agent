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

import { extractFocusAreas } from './shared.js';

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

  if (hypotheticalTurns > 0) {
    advice.push({
      title: 'Replace theory with proof',
      detail: 'When a question asks about a skill, lead with a real project you have already worked on. Use a simple structure: situation, your action, result.',
      example: 'Instead of saying "I would use React Native to build this", say "In my last project, I used React Native to build X, solved Y, and improved Z."',
    });
  }
  if (evidenceStrength < 2.2) {
    advice.push({
      title: 'Add action and outcome to every answer',
      detail: 'Your answers will sound stronger if each one includes what you personally did and what changed because of it.',
      example: 'Use this pattern: "The challenge was..., I handled..., and the result was..."',
    });
  }
  if (directTurns < 3) {
    advice.push({
      title: 'Prepare 3 reusable story banks',
      detail: 'Before the next interview, prepare three stories that show technical problem-solving, teamwork, and ownership. Reuse them across different questions.',
      example: 'Pick one mobile feature, one debugging story, and one collaboration story, then practise telling each in under 90 seconds.',
    });
  }
  if (genericTurns >= 3) {
    advice.push({
      title: 'Reduce broad or generic wording',
      detail: 'Avoid staying at the level of tools and concepts. Interviewers usually want evidence of judgment, trade-offs, and execution.',
      example: 'Swap "I know testing is important" for "I added tests for X, caught Y issue early, and avoided regression in Z flow."',
    });
  }
  if ((interviewMetrics.plannedQuestionCount || 0) && interviewMetrics.interviewerQuestionCount !== interviewMetrics.plannedQuestionCount) {
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
      example: 'For each key project, prepare one sentence on the challenge, one on your actions, and one on the result.',
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
export const buildFallbackAnswerRewriteTips = ({ report, evidenceDiagnostics }) => {
  const suggestions = [];
  const strongestExample = String(report.sections?.find((section) => section.id === 'evidence_examples')?.content || '');
  const hasGenericAnswers = Number(evidenceDiagnostics.totals?.generic_filler || 0) > 0;

  suggestions.push({
    weak: 'I know React Native and I think I can build this feature.',
    better: 'In a previous project, I used React Native to build a mobile flow, handled state and API integration, and improved the user experience by fixing performance and stability issues.',
  });

  if (hasGenericAnswers) {
    suggestions.push({
      weak: 'I am a good problem solver and I work well in teams.',
      better: 'When we hit a blocker in a team project, I broke the issue into smaller parts, coordinated the handoff with teammates, and helped the team ship the feature on time.',
    });
  }

  if (strongestExample && strongestExample !== 'No high-strength interview examples were captured.') {
    suggestions.push({
      weak: 'A broad answer without enough context or outcome.',
      better: 'Use your strongest example as a model: give the context, explain your exact contribution, and end with the result or lesson learned.',
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
