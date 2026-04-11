import { unique } from './matchShared.js';

export const buildQuestionPlanHints = ({ rubric, requirementChecks, microScores, settings = {}, cvEvidenceProfile = {}, transitionProfile = {} }) => {
  const projectStack = (cvEvidenceProfile.sections?.projects || []).flatMap((item) => item.techStack || []).slice(0, 4);
  const mustProbeSkills = unique([
    ...(rubric.interviewTargets?.prioritySkills || []).slice(0, 4),
    ...requirementChecks.filter((item) => item.status !== 'met').slice(0, 3).map((item) => item.label),
    ...microScores.filter((item) => item.score >= 45 && item.score < 80).slice(0, 3).map((item) => item.label),
    ...projectStack,
  ]).slice(0, 7);

  const mustProbeExperience = unique([
    ...(rubric.interviewTargets?.experienceFocus || []).slice(0, 4),
    ...requirementChecks.filter((item) => /experience|project|production|stakeholder/i.test(item.label)).map((item) => item.label),
    ...(transitionProfile.careerTransitionSignal >= 0.7 ? ['career transition story', 'recent project depth'] : []),
  ]).slice(0, 6);

  const mustProbeBehavioural = unique([
    ...(rubric.interviewTargets?.behaviouralFocus || []).slice(0, 4),
    ...(settings.enableNZCultureFit ? ['teamwork', 'communication', 'adaptability'] : []),
    ...((cvEvidenceProfile.behaviouralCapabilities || []).map((item) => item.replace(/_/g, ' '))),
  ]).slice(0, 6);

  return {
    roleCanonical: rubric.roleCanonical,
    roleFamily: rubric.roleFamily,
    roleLevel: rubric.roleLevel,
    mustProbeSkills,
    mustProbeExperience,
    mustProbeBehavioural,
    avoidTopics: [],
    followUpAnchors: unique([...mustProbeSkills.slice(0, 3), ...mustProbeExperience.slice(0, 2), ...projectStack.slice(0, 2)]),
    orderedStages: ['opening', 'technical_core', 'experience_deep_dive', 'project_validation', 'behavioural', 'gap_probe', 'wrap_up'],
  };
};
