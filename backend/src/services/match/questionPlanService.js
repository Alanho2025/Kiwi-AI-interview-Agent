/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: questionPlanService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { unique } from './matchShared.js';

/**
 * Purpose: Execute the main responsibility for buildQuestionPlanHints.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildQuestionPlanHints = ({ rubric, requirementChecks, microScores, settings = {} }) => {
  const mustProbeSkills = unique([
    ...(rubric.interviewTargets?.prioritySkills || []).slice(0, 4),
    ...requirementChecks.filter((item) => item.status !== 'met').slice(0, 3).map((item) => item.label),
    ...microScores.filter((item) => item.score >= 45 && item.score < 80).slice(0, 3).map((item) => item.label),
  ]).slice(0, 6);

  const mustProbeExperience = unique([
    ...(rubric.interviewTargets?.experienceFocus || []).slice(0, 4),
    ...requirementChecks.filter((item) => /experience|project|production|stakeholder/i.test(item.label)).map((item) => item.label),
  ]).slice(0, 5);

  const mustProbeBehavioural = unique([
    ...(rubric.interviewTargets?.behaviouralFocus || []).slice(0, 4),
    ...(settings.enableNZCultureFit ? ['teamwork', 'communication', 'adaptability'] : []),
  ]).slice(0, 5);

  return {
    roleCanonical: rubric.roleCanonical,
    roleFamily: rubric.roleFamily,
    roleLevel: rubric.roleLevel,
    mustProbeSkills,
    mustProbeExperience,
    mustProbeBehavioural,
    avoidTopics: [],
    followUpAnchors: unique([...mustProbeSkills.slice(0, 3), ...mustProbeExperience.slice(0, 2)]),
    orderedStages: ['opening', 'technical_core', 'experience_deep_dive', 'behavioural', 'gap_probe', 'wrap_up'],
  };
};
