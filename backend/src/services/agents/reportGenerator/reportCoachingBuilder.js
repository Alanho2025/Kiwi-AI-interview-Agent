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

/**
 * Purpose: Execute the main responsibility for buildImprovementPriorities.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildImprovementPriorities = ({ analysisResult, evidenceSummary, interviewMetrics }) => {
  const priorities = [];

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0) {
    priorities.push({
      title: 'Use more real project examples',
      whyItMatters: 'Interviewers trust demonstrated experience more than theoretical explanations.',
      action: 'Prepare 2-3 project stories that clearly explain the situation, your actions, and the result.',
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
      action: 'For each key project, prepare one sentence on the challenge, one on your contribution, and one on the outcome.',
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
export const buildCoachingAdvice = ({ evidenceSummary, interviewPlan = {} }) => {
  const focusAreas = (interviewPlan.interviewFocus || []).filter(Boolean);
  const advice = [];

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0) {
    advice.push({
      theme: 'Replace theory with proof',
      advice: 'When a question asks about a skill, lead with a real project you have already worked on.',
      example: 'Instead of saying "I would use React Native to build this", say "In my last project, I used React Native to build X, solved Y, and improved Z."',
    });
  }

  if ((evidenceSummary.averageStrength || 0) < 2.2) {
    advice.push({
      theme: 'Add action and outcome',
      advice: 'Your answers will feel stronger if each one includes what you personally did and what changed because of it.',
      example: 'Use this pattern: "The challenge was..., I handled..., and the result was..."',
    });
  }

  if ((evidenceSummary.totals.direct_past_experience || 0) < 3) {
    advice.push({
      theme: 'Prepare reusable stories',
      advice: 'Build a small bank of stories that show technical problem-solving, collaboration, and ownership.',
      example: 'Prepare one mobile feature story, one debugging story, and one teamwork story, each in under 90 seconds.',
    });
  }

  if ((evidenceSummary.totals.generic_filler || 0) >= 3) {
    advice.push({
      theme: 'Avoid generic wording',
      advice: 'Move past tools and concepts, and explain your judgment, trade-offs, and execution.',
      example: 'Swap "I know testing is important" for "I added tests for X, caught Y issue early, and avoided regression in Z flow."',
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
      example: 'For each project, prepare one sentence on the challenge, one on your actions, and one on the result.',
    });
  }

  return advice.slice(0, 4);
};

/**
 * Purpose: Execute the main responsibility for buildAnswerRewriteExamples.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildAnswerRewriteExamples = ({ evidenceSummary }) => {
  const examples = [
    {
      weak: 'I think I would use React Native to do that.',
      better: 'In a previous project, I used React Native to build a mobile flow, handled API integration, and improved the user experience by fixing performance and stability issues.',
    },
  ];

  if ((evidenceSummary.totals.generic_filler || 0) > 0) {
    examples.push({
      weak: 'I am a good problem solver and I work well in teams.',
      better: 'When our team hit a blocker, I broke the issue into smaller parts, coordinated the handoff with teammates, and helped the team ship the feature on time.',
    });
  }

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0) {
    examples.push({
      weak: 'If I was given that problem, I would probably approach it by using the framework carefully.',
      better: 'In my last project, I faced a similar problem, chose a practical approach, implemented it step by step, and checked the result through testing and review.',
    });
  }

  return examples.slice(0, 3);
};
